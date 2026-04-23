# Activity Metrics Reference

This document describes the full pipeline by which **repopopindex** measures repository activity on **GitHub** and **Hugging Face**: what raw signals are collected, how they are normalized and weighted, and how the final composite score is produced.

All code references use paths relative to the repository root.

---

## 1. Pipeline Overview

```
HTTP POST /api/analyze
  └─► Inngest event "analysis/run"
        └─► runAnalysis()                       src/lib/orchestrator.ts
              ├─ collect (Promise.allSettled)   src/lib/collectors/*
              │    ├─ github-graphql
              │    ├─ github-rest
              │    ├─ github-search
              │    ├─ github-scraper (dependents)
              │    ├─ star-quality (sampled stargazers)
              │    ├─ huggingface
              │    └─ hackernews (shared social buzz)
              ├─ persist → rawMetrics
              ├─ computeScores()                src/lib/scoring/*
              │    ├─ normalize (log / linear, inverse)
              │    ├─ apply RECENCY_FACTOR for cumulative metrics
              │    ├─ weight per metric
              │    ├─ aggregate per category (insufficiency gate)
              │    └─ aggregate categories → composite (0–100)
              └─ persist → scores
```

Timeouts: each collector has a 15 s deadline (`COLLECTOR_TIMEOUT`); total analysis 60 s (`TOTAL_TIMEOUT`). Concurrency is capped by `MAX_CONCURRENT_ANALYSES` (default 5).

Rate limits live in `src/lib/rate-limiter.ts` (Upstash Redis backed):

| Source | Limit |
|---|---|
| `github-rest` | 5000 req / 3600 s |
| `github-graphql` | 5000 req / 3600 s |
| `github-search` | 30 req / 60 s |
| `huggingface` | 1000 req / 300 s |
| `hackernews` | 10000 req / 3600 s |

Retries (`src/lib/retry.ts`): 3 attempts, exponential backoff (2 s → 30 s), honors `Retry-After` on 429.

---

## 2. Storage Schema

Source: `src/db/schema.ts`

### `analyses`
Tracks one evaluation run.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `platform` | enum | `github` \| `huggingface` |
| `owner`, `repo` | text | |
| `period` | enum | `1w` \| `1m` \| `3m` \| `6m` \| `1y` (default `3m`) |
| `status` | enum | `queued` \| `collecting` \| `scoring` \| `complete` \| `partial` \| `failed` |
| `inputUrl`, `error`, `createdAt`, `completedAt` | | |

### `rawMetrics`
One row per collected indicator per run.

| Column | Notes |
|---|---|
| `analysisId` | FK → `analyses.id` (cascade) |
| `source` | `github-graphql`, `github-rest`, `github-search`, `github-scraper`, `star-quality`, `huggingface`, `hackernews` |
| `category` | `G1`..`G8`, `H1`..`H5`, `S1` |
| `metricKey` | e.g. `stars`, `G2.4`, `downloads` |
| `rawValue` | `real`, nullable |
| `rawJson` | `jsonb`, for complex payloads (e.g. UQS sub-scores) |

### `scores`
Final computed view of the run.

| Column | Notes |
|---|---|
| `compositeScore` | 0–100 |
| `categoryScores` | `Record<categoryId, { name, score, maxScore:100, metrics, insufficient, reason? }>` |
| `metricScores` | `Record<metricKey, { raw, normalized, weighted }>` |
| `excludedCategories` | string[] of category IDs dropped for insufficient data |
| `starQualityFactor`, `starQualityRecent`, `starQualityHistorical`, `starBurstDetected` | denormalized from G8 for quick reads |
| `hnData` | `{ storyCount, totalPoints, totalComments, topStory, engagement }` |

---

## 3. GitHub Data Collection

### 3.1 GraphQL — `src/lib/collectors/github-graphql.ts`

Endpoint: `POST https://api.github.com/graphql`, bearer token via `GITHUB_TOKEN`.
Two queries exist — `QUERY` (with discussions) and `QUERY_NO_DISCUSSIONS` (fallback).

Emitted metrics:

| metricKey | Category | Source field |
|---|---|---|
| `stars` | G1 | `stargazerCount` |
| `forks` | G1 | `forkCount` |
| `watchers` | G1 | `watchers.totalCount` |
| `G2.5` | G2 | `defaultBranchRef.target.history.totalCount` (since `period`) |
| `open_issues` | G3 (metadata) | `issues(states:OPEN).totalCount` |
| `open_prs` | G4 (metadata) | `pullRequests(states:OPEN).totalCount` |
| `discussions_count` | G3 (metadata) | `discussions.totalCount` |

Also captured as metadata (not scored): `createdAt`, `pushedAt`, `description`, `primaryLanguage.name`, `licenseInfo.spdxId`, `hasIssuesEnabled`, `hasDiscussionsEnabled`.

### 3.2 REST — `src/lib/collectors/github-rest.ts`

| Endpoint | Derived metric(s) |
|---|---|
| `/repos/{o}/{r}/stats/participation` | `G2.1` (sum of `all[]`), `G2.2` (external share = `1 − sumOwner/sumAll`), `G2.6` (activity momentum = `recent4/prior4`) |
| `/repos/{o}/{r}/stats/code_frequency` | `G2.3_additions`, `G2.3_deletions` (since `period`) |
| `/repos/{o}/{r}/community/profile` | `G7.1` (`health_percentage`), `G7.2` CONTRIBUTING, `G7.3` code_of_conduct, `G7.4` README |
| `/repos/{o}/{r}/releases?per_page=100` | `G5.1` count-in-period, `G5.2` avg days between releases, `G5.3` sum of asset downloads |
| `/repos/{o}/{r}/contributors?per_page=1&anon=true` | `G2.4` total contributor count (parsed from `Link: rel="last"`) |
| `/repos/{o}/{r}/tags?per_page=1` | `G5.4` tag count (via pagination link) |

### 3.3 Search — `src/lib/collectors/github-search.ts`

Endpoint: `GET https://api.github.com/search/issues`

Queries (where `since = period start`):
- `repo:o/r+type:issue+created:>{since}` → `G3.1`
- `repo:o/r+type:issue+closed:>{since}`   → `G3.2`
- `repo:o/r+type:pr+created:>{since}`     → `G4.1`
- `repo:o/r+type:pr+merged:>{since}`      → `G4.2`

Derived in-memory:
- `G3.3` = `G3.2 / G3.1` (issue close rate, 0–1)
- `G4.3` = `G4.2 / G4.1` (PR merge rate, 0–1)
- `G4.4` = unique PR authors among merged items
- `G4.5` = **median** merge time in calendar days (`merged_at − created_at`)

### 3.4 Dependents scraper — `src/lib/collectors/github-scraper.ts`

HTML scrape of `https://github.com/{o}/{r}/network/dependents`; regex `(\d[\d,]*)\s*Repositories` → `G6.1`. 10 s timeout.

### 3.5 Star quality — `src/lib/collectors/star-quality.ts`

Samples up to ~100 most-recent stargazers plus ~100 at the midpoint of history, via GraphQL (`stargazerCount`, `starredAt`, and per-user `createdAt`, `followers`, `repositories`, `contributionsCollection.contributionCalendar.totalContributions`).

**Per-user UQS** (User Quality Score):

```
ageDays = (now − user.createdAt) / 86_400_000

bot = ageDays < 7
      OR (followers == 0 AND repositories == 0 AND contributions == 0)

if bot: UQS = 0
else:
  A = min(1, ageDays          / 730)
  F = min(1, log(1+followers) / log(1+100))
  R = min(1, log(1+repos)     / log(1+30))
  C = min(1, log(1+contribs)  / log(1+500))
  UQS = 0.25·A + 0.25·F + 0.25·R + 0.25·C
```

**Emitted metrics:**

- `G8.1` = `totalStars × avgUqs`, where `avgUqs = (avgUqsRecent + avgUqsHistorical) / 2`.
  `rawJson` stores `{ avgUqsRecent, avgUqsHistorical, avgUqs, burstDetected }`.
- `G8.2` = stars-per-day on the recent sample = `recentEdges.length / rangeDays`
  (`rangeDays = (newest.starredAt − oldest.starredAt) / 86_400_000`).
- `G8.3` = **burst flag** (0/1): set when any calendar-day bucket exceeds `5 × dailyAvg`
  of the recent 100-stargazer window.

---

## 4. Hugging Face Data Collection

Source: `src/lib/collectors/huggingface.ts`

Endpoints (bearer token optional via `HF_TOKEN`):
1. `GET /api/models/{o}/{r}`, falling back to `GET /api/datasets/{o}/{r}` on 404.
2. `GET {base}/commits?limit=100&cursor=…` (paginated, up to 10 pages).
3. `GET {base}/discussions?limit=100`.

| metricKey | Category | Derivation |
|---|---|---|
| `likes` | H1 | `likes` |
| `downloads` | H1 | `downloads` (recent window) |
| `downloadsAllTime` | H1 | `downloadsAllTime` |
| `trendingScore` | H1 | `trendingScore` |
| `spaces_count` | H2 | `spaces[].length` |
| `inferenceProviderCount` | H2 | count of keys in `inferenceProviderMapping` |
| `inference` | H2 (metadata) | `inference` string |
| `library_name` | metadata | `library_name` |
| `card_score` | H4 | 1.0 if `cardData.description` AND `cardData.license` present, 0.5 if one, else 0 |
| `commit_count` | H3 | count of commits since `period` |
| `unique_contributors` | H3 | size of the set of commit authors (by user/name) |
| `days_since_last_commit` | H3 | `floor((now − lastCommitDate)/86_400_000)` |
| `discussion_count` | H4 | total discussions |
| `pr_count` | H4 | count where `type === "pull_request"` |

An auxiliary **HF quality factor** is stored in `rawJson` for `likes`:

```
likeDenom        = log(1 + likes·100)
hfQualityFactor  = min(1, log(1 + downloads30d) / likeDenom)
qualityLikeScore = likes · max(0.3, hfQualityFactor)
```

---

## 5. Hacker News (shared S1)

Collected for both platforms. Produces `story_count`, `total_points`, `total_comments`, `engagement` (weighted interest), and a `top_story` metadata record stored in `scores.hnData`.

---

## 6. Metric Configuration

Source: `src/lib/scoring/config.ts`

Each metric is declared as:

```ts
{
  source, key, category,
  maxI,        // saturation ceiling used by normalizer
  weight,      // integer weight inside its category
  cumulative?, // if true, recency factor applies
  linear?,     // if true, linear normalization; default is logarithmic
  inverse?     // if true, value is inverted before normalization (lower raw = better)
}
```

**Tuning constant — `RECENCY_FACTOR = 0.75`** (raised from `0.3` in commit `b201cb4` so top repos don’t hit an unfair ceiling).

### 6.1 GitHub metric configs

| Key | Category | maxI | Weight | cumul | linear | inverse |
|---|---|---:|---:|:-:|:-:|:-:|
| `stars` | G1 | 50 000 | 3 | ✓ | | |
| `forks` | G1 | 15 000 | 1 | ✓ | | |
| `watchers` | G1 | 5 000 | 1 | ✓ | | |
| `G2.4` contributors | G2 | 500 | 3 | | | |
| `G2.5` graphql commits | G2 | 500 | 2 | | | |
| `G2.2` external share | G2 | 1.0 | 2 | | ✓ | |
| `G2.3_additions` | G2 | 50 000 | 1 | | | |
| `G2.6` momentum | G2 | 3.0 | 2 | | ✓ | |
| `G3.1` issues opened | G3 | 200 | 1 | | | |
| `G3.2` issues closed | G3 | 200 | 1 | | | |
| `G3.3` close rate | G3 | 1.0 | 2 | | ✓ | |
| `G4.1` PRs opened | G4 | 100 | 1 | | | |
| `G4.2` PRs merged | G4 | 100 | 2 | | | |
| `G4.3` merge rate | G4 | 1.0 | 1 | | ✓ | |
| `G4.4` PR authors | G4 | 100 | 3 | | | |
| `G4.5` median TTM | G4 | 14 | 1 | | | ✓ |
| `G5.1` releases | G5 | 50 | 1 | | | |
| `G5.2` cadence | G5 | 90 | 1 | | ✓ | ✓ |
| `G5.3` release DLs | G5 | 1 000 000 | 2 | | | |
| `G5.4` tags | G5 | 200 | 0 | | | |
| `G6.1` dependents | G6 | 100 000 | 3 | ✓ | | |
| `G7.1` community health | G7 | 100 | 1 | ✓ | ✓ | |
| `G8.1` star quality mass | G8 | 50 000 | 3 | ✓ | | |
| `G8.2` account-age balance | G8 | 100 | 2 | | | |
| `story_count` | S1 | 50 | 1 | | | |
| `total_points` | S1 | 2 000 | 1 | | | |
| `engagement` | S1 | 5 000 | 1 | | | |

### 6.2 Hugging Face metric configs

| Key | Category | maxI | Weight | cumul | linear | inverse |
|---|---|---:|---:|:-:|:-:|:-:|
| `likes` | H1 | 5 000 | 2 | ✓ | | |
| `downloads` | H1 | 10 000 000 | 3 | | | |
| `downloadsAllTime` | H1 | 100 000 000 | 2 | ✓ | | |
| `trendingScore` | H1 | 100 | 1 | | | |
| `spaces_count` | H2 | 100 | 2 | ✓ | | |
| `inferenceProviderCount` | H2 | 10 | 1 | ✓ | | |
| `commit_count` | H3 | 500 | 2 | | | |
| `unique_contributors` | H3 | 50 | 2 | | | |
| `days_since_last_commit` | H3 | 365 | 1 | | | ✓ |
| `discussion_count` | H4 | 100 | 1 | | | |
| `pr_count` | H4 | 50 | 1 | | | |
| `card_score` | H4 | 1.0 | 1 | ✓ | ✓ | |
| `story_count`, `total_points`, `engagement` | S1 | 50 / 2 000 / 5 000 | 1 / 1 / 1 | | | |

### 6.3 Category configs

**GitHub** (weights sum to 100):

| ID | Name | Weight | Metric keys |
|---|---|---:|---|
| `G-Activity` | Activity | 20 | `G2.4`, `G2.5`, `G2.2`, `G2.3_additions`, `G2.6` |
| `G-Community` | Community | 20 | `G3.1`, `G3.2`, `G3.3`, `G4.1`, `G4.2`, `G4.3`, `G4.4`, `G4.5` |
| `G-Adoption` | Adoption | 25 | `G6.1`, `G5.1`, `G5.2`, `G5.3`, `G5.4` |
| `G-Popularity` | Popularity | 15 | `stars`, `forks`, `watchers`, `G8.1`, `G8.2` |
| `G-Health` | Health | 5 | `G7.1` |
| `G-Social` | Social Buzz | 15 | `story_count`, `total_points`, `engagement` |

**Hugging Face** (weights sum to 100):

| ID | Name | Weight | Metric keys |
|---|---|---:|---|
| `H-Downloads` | Downloads | 25 | `downloads`, `downloadsAllTime` |
| `H-Integration` | Integration | 20 | `spaces_count`, `inferenceProviderCount` |
| `H-Activity` | Activity | 20 | `commit_count`, `unique_contributors`, `days_since_last_commit` |
| `H-Community` | Community | 10 | `discussion_count`, `pr_count`, `card_score` |
| `H-Popularity` | Popularity | 10 | `likes`, `trendingScore` |
| `H-Social` | Social Buzz | 15 | `story_count`, `total_points`, `engagement` |

---

## 7. Scoring Pipeline

Source: `src/lib/scoring/` (`normalizer.ts`, `category-scores.ts`, `composite-score.ts`).

### Step 1 — Normalize each metric to `[0, 1]`

```ts
function normalizeMetric(raw, cfg) {
  if (raw == null) return null;
  let v = cfg.inverse ? Math.max(0, cfg.maxI - raw) : raw;
  const n = cfg.linear
    ? Math.min(1, v / cfg.maxI)
    : Math.min(1, Math.log(1 + v) / Math.log(1 + cfg.maxI));
  return Math.max(0, Math.min(1, n));
}
```

- **Default = logarithmic** saturation against `maxI`.
- `linear: true` uses a linear ramp — used for bounded ratios (`G2.2`, `G3.3`, `G4.3`, `G2.6`, `G7.1`, `card_score`, `G5.2`).
- `inverse: true` flips the scale so *lower is better* (`G4.5` time-to-merge, `G5.2` release cadence, `days_since_last_commit`).

### Step 2 — Recency factor for cumulative metrics

```ts
function applyRecencyFactor(n, cfg) {
  return cfg.cumulative ? n * RECENCY_FACTOR : n;   // 0.75
}
```

This down-weights all-time signals (stars, forks, dependents, all-time downloads, G7.1 health, G8.1 stargazer mass, card_score, likes, spaces_count, inferenceProviderCount) relative to period-scoped activity so that a currently-active project isn’t dominated by historical accumulation.

### Step 3 — Weight within a category

```ts
weighted = recencyAdjusted * cfg.weight;   // cfg.weight > 0
```

### Step 4 — Category aggregation with an insufficiency gate

```ts
// countable = metrics in this category with weight > 0
insufficient = availableCount < countableTotal * 0.5;

categoryScore = insufficient
  ? 0
  : 100 * (Σ recencyAdjusted·weight) / (Σ weight over available metrics);
```

If fewer than half of the countable metrics produced a value, the category is marked `insufficient` and **excluded** from the composite. This is also the distinction between final `status = "complete"` and `status = "partial"`.

### Step 5 — Composite score (0–100)

```ts
for each category in platform:
  if insufficient: push to excludedCategories; continue
  weightedSum += category.weight * category.score
  totalWeight += category.weight

compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
```

### Worked example (GitHub)

Suppose category scores come out as:

| Category | Score | Weight |
|---|---:|---:|
| Activity | 80 | 20 |
| Community | 60 | 20 |
| Adoption | 50 | 25 |
| Popularity | 90 | 15 |
| Health | 70 | 5 |
| Social | 40 | 15 |

```
weightedSum    = 20·80 + 20·60 + 25·50 + 15·90 + 5·70 + 15·40 = 6350
totalWeight    = 100
compositeScore = 6350 / 100 = 63.5
```

---

## 8. Display Labels

Source: `src/lib/i18n/metric-labels.ts` (commit `868102c`).

`getMetricLabel(key, locale)` returns a short label (for tables); `getMetricDescription(key, locale)` returns the hover tooltip. English copy:

### GitHub

| Key | Short | Description |
|---|---|---|
| `stars` | Star count | Total GitHub stars; measures broad recognition of the repository. |
| `forks` | Fork count | Number of repository forks, indicating reuse and experimentation. |
| `watchers` | Watchers | Users watching the repo for activity notifications. |
| `G2.1` | Commits (window) | Total commit count in the selected time window. |
| `G2.2` | Ext. contributor share | Share of commits from people other than the repo owner. |
| `G2.3_additions` | Code additions | Lines added in the period. |
| `G2.3_deletions` | Code deletions | Lines removed in the period. |
| `G2.4` | Contributors | Distinct contributors with commits in the period. |
| `G2.5` | GraphQL commits | Commit count as reported via GitHub’s GraphQL API. |
| `G2.6` | Activity momentum | Recent 4-week vs prior 4-week commit ratio (>1 = accelerating). |
| `G3.1` | Issues opened | Issues created in the period. |
| `G3.2` | Issues closed | Issues closed in the period. |
| `G3.3` | Issue close rate | `closed / opened` in the period (0–1). |
| `G4.1` | PRs opened | PRs opened in the period. |
| `G4.2` | PRs merged | PRs merged in the period. |
| `G4.3` | PR merge rate | Share of PRs merged (0–1). |
| `G4.4` | PR author diversity | Distinct PR authors. |
| `G4.5` | Median time to merge | Median calendar days to merge; lower is faster. |
| `G5.1` | Releases in period | Number of releases in the window. |
| `G5.2` | Release cadence | Avg days between releases; lower is better. |
| `G5.3` | Release downloads | Sum of release asset downloads in the period. |
| `G5.4` | Tag count | Number of version tags (auxiliary, zero-weighted). |
| `G6.1` | Dependents | Public repos depending on this one (best-effort). |
| `G7.1` | Community health % | GitHub’s community health score (0–100). |
| `G7.2–G7.4` | Has CONTRIBUTING / Code of conduct / README | Presence flags (1/0). |
| `G8.1` | Sampled stargazer mass | `totalStars × avgUqs` from sampled stargazers. |
| `G8.2` | Account-age balance | Recent stars-per-day on the sampled window. |
| `G8.3` | Burst flag | 1 when a star-activity burst was detected. |

### Hugging Face

| Key | Short | Description |
|---|---|---|
| `likes` | Likes | Model/dataset like count. |
| `downloads` | Recent downloads | Recent-window download count. |
| `downloadsAllTime` | All-time downloads | Cumulative download count. |
| `trendingScore` | Trending score | HF trending signal. |
| `spaces_count` | HF Spaces | Spaces using this model/repo. |
| `inference` | Inference uses | Inference-related count from card metadata. |
| `inferenceProviderCount` | Inf. providers | Third-party inference providers. |
| `commit_count` | HF commits | Commits in the period. |
| `unique_contributors` | HF contributors | Unique contributors in the period. |
| `days_since_last_commit` | Days since commit | Calendar days since last commit (lower = better). |
| `discussion_count` | Discussions | Community discussions count. |
| `pr_count` | HF PRs | Pull requests in the period. |
| `card_score` | Model card quality | Card/metadata completeness (0 / 0.5 / 1). |
| `library_name` | Library tag | Associated library name (auxiliary). |

### Social (shared S1)

| Key | Short | Description |
|---|---|---|
| `story_count` | HN stories | Hacker News stories mentioning the repo in the period. |
| `total_points` | HN points | Sum of points on matching stories. |
| `total_comments` | HN comments | Total comments on matching stories. |
| `engagement` | HN engagement | Weighted HN interest (points + comments). |
| `top_story` | Top HN item | Highest-point matching story (metadata). |

Fallback when a key is not registered: `humanizeKey(key)` for the label and a generic “Metric value in the score model.” description.

---

## 9. Entry Points

| Surface | Path | Purpose |
|---|---|---|
| HTTP | `POST /api/analyze` (`src/app/api/analyze/route.ts`) | Validate URL, insert `analyses` row (`queued`), send Inngest `analysis/run` event |
| HTTP | `GET /api/status/[id]` | Progress polling |
| HTTP | `GET /api/report/[id]` | Final report (`analyses` + `scores`) |
| Inngest | `analyze-repo` on event `analysis/run` (`src/inngest/functions/analyze.ts`) | Orchestrated pipeline, concurrency capped |
| Script | `scripts/migrate.mjs` | Drizzle migrations with advisory lock |

Progress stages reported through `analyses.status`: `queued → collecting → scoring → complete | partial | failed`.
