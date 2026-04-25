# RepoPopIndex — Comprehensive Development Plan

> **Version:** 1.1
> **Date:** 2026-04-22
> **Status:** DRAFT — Iteration 2

---

## RALPLAN-DR Summary

### Principles

1. **Composite Over Single-Metric**: No single number captures repository health. Every score is a weighted composite of multiple signals across distinct dimensions (activity, community, quality, buzz).
2. **Abuse-Resistant by Default**: Raw counts (stars, likes, downloads) are never trusted at face value. Every popularity signal passes through a quality-weighting filter before inclusion in scores.
3. **Time-Aware Analysis**: A repo that got 5,000 stars 3 years ago and none since is fundamentally different from one getting 100/week. Every metric is evaluated across user-selected time windows.
4. **API-Budget Conscious**: GitHub rate limits (5,000 REST/hr, 5,000 GraphQL points/hr) and Search API limits (30 req/min) are binding constraints. Architecture must minimize API calls through GraphQL batching, Search API for time-filtered counts, caching, and progressive disclosure.
5. **Transparent Scoring**: Users must be able to drill down from the final score to see exactly which metrics contributed what weight. No black boxes.

### Decision Drivers

1. **Rate Limit Economics**: GitHub GraphQL gives 10-50x more data per request than REST for non-time-filtered data. The Search API (30 req/min, separate from core limits) is required for accurate time-window filtering on issues and PRs. HF has its own limits (500-1000 req/5min).
2. **No Time-Series APIs**: Neither GitHub nor HF provide historical download/star trends via API. We must either compute deltas from snapshots we collect over time, or derive trends from timestamped events (stargazer dates, commit dates).
3. **Third-Party Traffic Unavailable**: GitHub traffic endpoints (views, clones) require owner auth. The scoring system must produce meaningful results WITHOUT traffic data, with optional enhancement when the user provides a PAT with repo scope.

### Viable Options

#### Option A: Next.js Full-Stack Monolith (RECOMMENDED)

- **Stack**: Next.js 15 (App Router) + TypeScript + Redis + Tailwind CSS + shadcn/ui + Recharts
- **Deployment**: Vercel (frontend + API routes) + Upstash (Redis)
- **Pros**: Single codebase, SSR for SEO, API routes co-located, excellent DX, Vercel edge caching for free, strong ecosystem
- **Cons**: Vercel function timeout (60s on Pro) may limit large analyses, vendor coupling, monolith scaling limits
- **Mitigation**: Inngest for background jobs; polling-based progress tracking (no SSE needed)

#### Option B: Separate Frontend + Backend

- **Stack**: React/Vite (frontend) + Hono/Fastify (API) + Redis
- **Deployment**: Cloudflare Pages (frontend) + Fly.io or Railway (API) + Upstash (Redis)
- **Pros**: Independent scaling, no function timeouts, flexible deployment, lighter frontend bundle
- **Cons**: Two codebases to maintain, CORS config, separate CI/CD pipelines, more infra to manage
- **Mitigation**: Monorepo (Turborepo) to share types/utils

#### Decision: Option A (Next.js Full-Stack)

**Why**: For an MVP/v1, the DX and deployment simplicity of Next.js outweigh the scaling limitations. The timeout constraint is solved by offloading all analyses to Inngest background functions with Redis-based progress tracking. If scaling demands exceed Vercel limits in the future, the API routes can be extracted to a standalone server with minimal refactoring since they are already isolated in `app/api/`.

---

## 1. Project Overview & Goals

**RepoPopIndex** is a web application that quantifies how actively GitHub repositories and Hugging Face models/datasets are being used in the real world. It goes beyond surface-level metrics (stars, likes) by analyzing commit velocity, contributor diversity, issue responsiveness, dependency adoption, release cadence, social buzz, and star/like quality — producing a single composite "Popularity Index" score (0-100) with full drill-down transparency.

### Core Goals

1. Accept any GitHub repo URL or Hugging Face model/dataset URL as input
2. Collect 30+ quantitative metrics from multiple API sources
3. Weight stars/likes by account quality to detect and discount artificial inflation
4. Compute category-level and overall composite scores (0-100)
5. Display results across 5 time periods: 1 week, 1 month, quarter, half-year, 1 year
6. Include social buzz signals from HackerNews (v1), with Reddit/SO/YouTube deferred to post-launch
7. Render a comprehensive visual report with charts, tables, and trend indicators

### Non-Goals (v1)

- User accounts / saved reports (future)
- Batch comparison of multiple repos side-by-side (future)
- Historical trend tracking via periodic snapshots (future — requires cron infrastructure)
- npm/PyPI download integration (future)
- GitHub traffic metrics requiring owner auth (optional enhancement only)
- Reddit, Stack Overflow, YouTube social collectors (deferred to Phase 8 — see Section 10.4)

---

## 2. Complete Metrics Catalog

### 2.1 GitHub Metrics (38 metrics across 9 categories)

#### Category G1: Repository Fundamentals (6 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G1.1 | Star count | `GET /repos/{owner}/{repo}` → `stargazers_count` | No | Raw count, quality-weighted separately |
| G1.2 | Fork count | `GET /repos/{owner}/{repo}` → `forks_count` | No | |
| G1.3 | Watcher count | `GET /repos/{owner}/{repo}` → `subscribers_count` | No | True watchers, not stars |
| G1.4 | Open issues count | `GET /repos/{owner}/{repo}` → `open_issues_count` | No | Includes PRs |
| G1.5 | Repository age (days) | `GET /repos/{owner}/{repo}` → `created_at` | No | Derived |
| G1.6 | Last push recency (days) | `GET /repos/{owner}/{repo}` → `pushed_at` | No | Derived: `now - pushed_at` |

#### Category G2: Commit Activity (6 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G2.1 | Weekly commit counts (52 weeks) | `GET /repos/{owner}/{repo}/stats/participation` → `all[]` | No | Returns 202 on first call — retry after 2s |
| G2.2 | Owner vs community commits | `GET /repos/{owner}/{repo}/stats/participation` → `owner[]` | No | Same endpoint |
| G2.3 | Code frequency (additions/deletions per week) | `GET /repos/{owner}/{repo}/stats/code_frequency` | No | 202 retry pattern |
| G2.4 | Contributor count | `GET /repos/{owner}/{repo}/contributors?per_page=1&anon=true` → `Link` header last page | No | Parse pagination |
| G2.5 | Commit count (recent period) | GraphQL `defaultBranchRef.target.history(since:)` → `totalCount` | Yes | Filtered by time window |
| G2.6 | Commit frequency trend | Derived from G2.1 | — | Compare recent 4 weeks vs prior 4 weeks |

**GraphQL for G2.5:**
```graphql
query($owner:String!, $name:String!, $since:GitTimestamp!) {
  repository(owner:$owner, name:$name) {
    defaultBranchRef {
      target {
        ... on Commit {
          history(since:$since) { totalCount }
        }
      }
    }
  }
}
```

#### Category G3: Issue Health (5 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G3.1 | Issues opened (period) | **GitHub Search API**: `GET /search/issues?q=repo:{owner}/{repo}+type:issue+created:>{date}` → `total_count` | Yes | Uses `created:` qualifier for accurate time-window filtering |
| G3.2 | Issues closed (period) | **GitHub Search API**: `GET /search/issues?q=repo:{owner}/{repo}+type:issue+closed:>{date}` → `total_count` | Yes | Uses `closed:` qualifier |
| G3.3 | Issue close ratio | Derived: G3.2 / G3.1 | — | |
| G3.4 | Median time to first response | `GET /repos/{owner}/{repo}/issues?state=closed&since={date}&per_page=30` + comments timeline | Yes | Sample 30 recent closed issues |
| G3.5 | Median time to close | Same sample as G3.4, `closed_at - created_at` | — | |

**Search API for G3.1/G3.2:**

> **Important**: GitHub's GraphQL `issues(filterBy:{since:})` filters by `updatedAt`, NOT `createdAt`. An issue opened 3 years ago but commented on recently would be incorrectly counted as "opened in period." The Search API's `created:` and `closed:` qualifiers filter on the correct timestamps.

```
# Issues created in period
GET /search/issues?q=repo:{owner}/{repo}+type:issue+created:>{iso_date}

# Issues closed in period
GET /search/issues?q=repo:{owner}/{repo}+type:issue+closed:>{iso_date}
```

**Rate limit note**: GitHub Search API has a separate rate limit of 30 requests/minute (authenticated). See Section 6.2 for budget accounting.

#### Category G4: Pull Request Activity (5 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G4.1 | PRs opened (period) | **GitHub Search API**: `GET /search/issues?q=repo:{owner}/{repo}+type:pr+created:>{date}` → `total_count` | Yes | Search API for accurate time filtering |
| G4.2 | PRs merged (period) | **GitHub Search API**: `GET /search/issues?q=repo:{owner}/{repo}+type:pr+merged:>{date}` → `total_count` | Yes | Uses `merged:` qualifier |
| G4.3 | PR merge ratio | Derived: G4.2 / G4.1 | — | |
| G4.4 | Unique PR contributors (period) | **GitHub Search API**: `GET /search/issues?q=repo:{owner}/{repo}+type:pr+merged:>{date}&per_page=30` → distinct `user.login` from items | Yes | Sample from search results |
| G4.5 | Median time to merge | **GitHub Search API**: Sample 30 recent merged PRs from search results → `pull_request.merged_at - created_at` | Yes | Search returns `created_at` and `pull_request.merged_at` |

**Search API for G4.1/G4.2/G4.4/G4.5:**

> **Important**: GitHub GraphQL `pullRequests` connection has NO `filterBy:{since:}` equivalent. Client-side filtering of the 100 most recent PRs is broken for high-activity repos (misses older PRs in period) and wasteful for low-activity repos. The Search API provides accurate time-window filtering.

```
# PRs created in period
GET /search/issues?q=repo:{owner}/{repo}+type:pr+created:>{iso_date}

# PRs merged in period
GET /search/issues?q=repo:{owner}/{repo}+type:pr+merged:>{iso_date}

# PRs merged in period with details (for G4.4/G4.5 sampling)
GET /search/issues?q=repo:{owner}/{repo}+type:pr+merged:>{iso_date}&sort=updated&order=desc&per_page=30
```

**Rate limit note**: Each G3/G4 search query counts against the 30 req/min Search API limit. A single analysis uses ~4-5 search queries for issues/PRs. See Section 6.2.

#### Category G5: Release & Distribution (4 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G5.1 | Release count (period) | `GET /repos/{owner}/{repo}/releases?per_page=100` filtered by `published_at` | No | |
| G5.2 | Release frequency (days between releases) | Derived from G5.1 timestamps | — | |
| G5.3 | Total download count (period) | Sum of `assets[].download_count` for releases in period | No | |
| G5.4 | Tag count | `GET /repos/{owner}/{repo}/tags?per_page=1` → `Link` header last page | No | |

#### Category G6: Dependency Adoption (2 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G6.1 | Dependents count | **HTML scrape**: `https://github.com/{owner}/{repo}/network/dependents` → parse `<a class="btn-link">X Repositories</a>` | No | No API available |
| G6.2 | Used-by count | Same page, "Used by" section | No | Alternative selector |

**Scraping approach for G6.1:**
```
GET https://github.com/{owner}/{repo}/network/dependents
Parse: <a class="btn-link" href="...">
  <svg>...</svg>
  \n          1,234,567\n          Repositories\n
</a>
Extract number with regex: /(\d[\d,]*)\s*Repositories/
```

#### Category G7: Community Health (4 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G7.1 | Community profile score | `GET /repos/{owner}/{repo}/community/profile` → `health_percentage` | No | 0-100 |
| G7.2 | Has README | Same endpoint → `files.readme` | No | Boolean |
| G7.3 | Has CONTRIBUTING | Same endpoint → `files.contributing` | No | Boolean |
| G7.4 | Has Code of Conduct | Same endpoint → `files.code_of_conduct` | No | Boolean |

#### Category G8: Stargazer Quality Analysis (3 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G8.1 | Quality-weighted star score | GraphQL stargazers + user profiles (sampled) | Yes | See Section 4 |
| G8.2 | Star growth rate (period) | `GET /repos/{owner}/{repo}/stargazers` with `Accept: application/vnd.github.star+json` → timestamps | No | Rate = stars_in_period / days |
| G8.3 | Star burst detection | Derived from G8.2 time series | — | Flag if single-day spikes > 5x daily average |

**GraphQL for stargazer sampling (G8.1):**
```graphql
query($owner:String!, $name:String!, $cursor:String) {
  repository(owner:$owner, name:$name) {
    stargazers(first:100, after:$cursor, orderBy:{field:STARRED_AT, direction:DESC}) {
      totalCount
      edges {
        starredAt
        node {
          login
          createdAt
          followers { totalCount }
          repositories(first:0) { totalCount }
          contributionsCollection { contributionCalendar { totalContributions } }
        }
      }
    }
  }
}
```

#### Category G9: Advanced Signals (3 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| G9.1 | Discussion count | GraphQL `discussions` → `totalCount` | Yes | Requires Discussions enabled |
| G9.2 | CI/CD status | `GET /repos/{owner}/{repo}/actions/runs?per_page=1` → `conclusion` | No | Latest workflow run |
| G9.3 | License type | `GET /repos/{owner}/{repo}` → `license.spdx_id` | No | Permissive = positive signal |

**GraphQL for G9.1:**
```graphql
query($owner:String!, $name:String!) {
  repository(owner:$owner, name:$name) {
    discussions { totalCount }
  }
}
```

---

### 2.2 Hugging Face Metrics (14 metrics across 5 categories)

#### Category H1: Popularity (4 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| H1.1 | Likes count | `GET https://huggingface.co/api/models/{id}` → `likes` | No | Quality-weighted (see Section 4) |
| H1.2 | Downloads (30-day) | Same → `downloads` | No | Rolling 30-day window |
| H1.3 | Downloads (all-time) | Same → `downloadsAllTime` | No | |
| H1.4 | Trending score | Same → `trendingScore` | No | HF internal trending algorithm |

#### Category H2: Usage & Integration (4 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| H2.1 | Linked spaces count | `GET /api/models/{id}` → `spaces` array length | No | Spaces using this model |
| H2.2 | Inference status | `GET /api/models/{id}` → `inference` (warm/cold/frozen) | No | Warm = actively used |
| H2.3 | Inference provider count | `GET /api/models/{id}` → `inferenceProviderMapping` keys count | No | More providers = more adoption |
| H2.4 | Library/framework | Same → `library_name` | No | transformers/diffusers/etc |

#### Category H3: Development Activity (3 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| H3.1 | Commit count | `GET /api/models/{id}/commits?limit=1000` → array length | No | Paginate if needed |
| H3.2 | Unique contributors | Derived: distinct `commit.authors` | — | |
| H3.3 | Last commit recency (days) | Latest commit `date` → `now - date` | — | |

#### Category H4: Community Engagement (2 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| H4.1 | Discussion count | `GET /api/models/{id}/discussions?limit=1` → check pagination total | No | |
| H4.2 | PR count + merge rate | `GET /api/models/{id}/discussions?type=pull_request` | No | Filter by type |

#### Category H5: Quality Signals (1 metric)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| H5.1 | Model card completeness | `GET /api/models/{id}` → `cardData` presence + sections | No | Has description, license, dataset info, eval results |

**Note on Datasets:** Replace `/api/models/` with `/api/datasets/` — same structure, fields differ slightly:
- `downloads` (30-day), `downloadsAllTime`, `likes`, `trendingScore` all available
- No inference fields — substitute with `viewer` (dataset viewer availability)
- `GET https://huggingface.co/api/datasets/{id}`

---

### 2.3 Social Buzz Metrics

> **Superseded for collector implementation by `.omc/plans/social-collectors-darklaunch.md` (v3).** Reddit / SO / YouTube are now dark-launched (collectors persist to `rpi:social:metrics:{analysisId}` Redis blob; do not affect UQS or report API surface). Section 10.4 designs are retained as the activation reference.

#### v1 Scope: Hacker News Only

For v1, social buzz is sourced exclusively from Hacker News. Reddit, Stack Overflow, and YouTube collectors are designed but deferred to Phase 8 (post-launch) due to API fragility and low individual weight. See Section 10.4 for deferred platform designs.

#### Category S1: Hacker News (2 metrics)

| # | Metric | API Endpoint | Auth | Notes |
|---|--------|-------------|------|-------|
| S1.1 | Total HN stories mentioning repo | `GET https://hn.algolia.com/api/v1/search?query=github.com/{owner}/{repo}&tags=story&hitsPerPage=100` → `nbHits` | No | 10,000 req/hr, no auth |
| S1.2 | Total HN points + comments | Sum `hits[].points` and `hits[].num_comments` | No | Weighted engagement |

**Query construction:**
- GitHub repos: `query=github.com/{owner}/{repo}` or `query="{repo name}"` with `tags=story`
- HF models: `query=huggingface.co/{org}/{model}` with `tags=story`
- Filter by date: `numericFilters=created_at_i>{unix_timestamp}`

#### Categories S2-S4: Deferred to Phase 8

Reddit (S2), Stack Overflow (S3), and YouTube (S4) collectors are designed in Section 10.4 but not implemented in v1. For v1, the G-Social / H-Social category score equals the HN engagement score alone (HN receives 100% of the social weight).

---

## 3. Scoring Methodology

### 3.1 Overall Formula

Inspired by the OpenSSF Criticality Score formula, adapted for a 0-100 scale with category groupings.

**Step 1: Normalize each raw metric to 0-1**

For each metric `i`:

```
S_i = log(1 + raw_i) / log(1 + max_i)
```

Where:
- `raw_i` = the collected metric value
- `max_i` = the "theoretical maximum" threshold (see calibration table below)
- Values are clamped to [0, 1]

**Step 2: Compute category scores (0-100)**

Each category `C` is a weighted average of its **available** normalized metrics:

```
CategoryScore_C = 100 * SUM(w_i * S_i) / SUM(w_i)    for all AVAILABLE metrics i in category C
```

**Missing-data rules:**
- Unavailable metrics (null / collector failed / feature disabled) are excluded from BOTH the numerator AND the denominator.
- If fewer than 50% of a category's metrics (by count) are available, the category is marked as **"insufficient data"** and excluded from the composite score entirely.
- When a category is excluded, the remaining categories are re-weighted proportionally so that their weights still sum to 100%.

**Step 3: Compute overall composite score (0-100)**

```
PopIndex = SUM(W_C * CategoryScore_C) / SUM(W_C)    for all INCLUDED categories C
```

Where `W_C` is the category weight (see Section 3.2), and excluded ("insufficient data") categories are omitted from both numerator and denominator.

The UI report displays which categories had insufficient data and why (e.g., "Issues: insufficient data — issues are disabled for this repository").

### 3.2 Category Weights

#### GitHub Repositories

| Category | Weight | Rationale |
|----------|--------|-----------|
| G-Activity (G2: Commits) | 20 | Most reliable signal of active development |
| G-Community (G3: Issues + G4: PRs) | 20 | External engagement, not just maintainer activity |
| G-Adoption (G6: Dependents + G5: Downloads) | 25 | Highest-signal metric per research — real-world usage |
| G-Popularity (G1: Stars/Forks, quality-weighted G8) | 15 | Important but gameable; quality-weighting reduces risk |
| G-Health (G7: Community profile) | 5 | Hygiene signal |
| G-Social (S1: HN engagement) | 15 | External validation beyond GitHub ecosystem (v1: HN only, 100% of social weight) |

#### Hugging Face Models/Datasets

| Category | Weight | Rationale |
|----------|--------|-----------|
| H-Downloads (H1.2, H1.3) | 25 | Direct usage signal |
| H-Integration (H2: Spaces, Inference) | 20 | Real deployment indicator |
| H-Activity (H3: Commits, Contributors) | 20 | Development momentum |
| H-Community (H4: Discussions, PRs) | 10 | Engagement depth |
| H-Popularity (H1.1: Likes, quality-weighted) | 10 | Gameable, lower weight |
| H-Social (S1: HN engagement) | 15 | External validation (v1: HN only, 100% of social weight) |

### 3.3 Metric Normalization Thresholds (max_i)

These are the "saturation" thresholds — values above this score 1.0:

| Metric | max_i | Calibration Source |
|--------|-------|-------------------|
| Stars | 50,000 | Top 0.01% repos |
| Forks | 15,000 | |
| Watchers | 5,000 | |
| Contributor count | 500 | |
| Commits/month | 500 | |
| Issues opened/month | 200 | |
| Issue close ratio | 1.0 (linear, not log) | Direct ratio |
| PRs merged/month | 100 | |
| Dependents count | 100,000 | |
| Release downloads | 1,000,000 | |
| HN total points | 2,000 | |
| HF downloads (30d) | 10,000,000 | |
| HF likes | 5,000 | |
| HF linked spaces | 100 | |

### 3.4 Metric-Level Weights (within categories)

| Category | Metric | Weight Within Category |
|----------|--------|----------------------|
| G-Activity | Commit count (period) | 2 |
| G-Activity | Community vs owner ratio | 2 |
| G-Activity | Contributor count | 3 |
| G-Activity | Code frequency (net additions) | 1 |
| G-Activity | Commit trend (recent vs prior) | 2 |
| G-Community | Issues opened (period) | 1 |
| G-Community | Issue close ratio | 2 |
| G-Community | Median time to first response | 2 |
| G-Community | PRs merged (period) | 2 |
| G-Community | Unique PR contributors | 3 |
| G-Adoption | Dependents count | 3 |
| G-Adoption | Release download count | 2 |
| G-Adoption | Release frequency | 1 |
| G-Popularity | Quality-weighted star score | 3 |
| G-Popularity | Fork count | 1 |
| G-Popularity | Watcher count | 1 |
| G-Popularity | Star growth rate (period) | 2 |
| G-Social | HN engagement | 1 |

> **v1 note**: G-Social contains only HN engagement (weight 1, i.e., 100% of the category). When Reddit/SO/YouTube are added in Phase 8, the within-category weights become: HN 3, Reddit 2, SO 2, YouTube 1.

### 3.5 Time-Period Weighting

When the user selects a time period, metrics are filtered to that window. For metrics that are cumulative (total stars, total dependents), we use period deltas where possible or apply a recency decay:

```
recency_factor = 1.0           (if event within selected period)
recency_factor = 0.3           (if event is cumulative/all-time with no period filter available)
```

**Application of `recency_factor`**: The factor is multiplied into `S_i` AFTER normalization but BEFORE category averaging. Specifically:

```
adjusted_S_i = S_i * recency_factor
```

This applies only to cumulative metrics that cannot be filtered by time period (e.g., total dependents count, total SO question count). Metrics that are already time-filtered (e.g., commits in period, issues opened in period) always use `recency_factor = 1.0`.

Available time periods:
- **1 week**: `since = now - 7d`
- **1 month**: `since = now - 30d`
- **Quarter**: `since = now - 90d`
- **Half-year**: `since = now - 180d`
- **1 year**: `since = now - 365d`

### 3.6 Edge Case Handling

The following edge cases must be handled gracefully — no unhandled errors, no division by zero, no misleading scores.

| Edge Case | Detection | Behavior |
|-----------|-----------|----------|
| **Zero-star repo** | `stargazers_count === 0` | `QualityStarScore = 0` (no division by zero in UQS). G8 metrics all zero. G-Popularity scored on forks and watchers only. |
| **No releases** | G5.1 count = 0 | G5 category metrics all zero. G-Adoption scored on dependents only (G6). If both G5 and G6 are zero, G-Adoption = 0. |
| **Discussions disabled** | GraphQL returns error for `discussions` field, OR `hasDiscussionsEnabled === false` | G9.1 = `null` (unavailable). Excluded from scoring per Section 3.1 missing-data rules. |
| **Empty repository** | `defaultBranchRef === null` | G2.5 commit count = 0. Not treated as an error. Other metrics (stars, forks, issues) still collected normally. |
| **Issues disabled** | `hasIssuesEnabled === false` | G3 category = "insufficient data" (all G3 metrics unavailable). Excluded from composite score; remaining categories re-weighted. |
| **PRs disabled / no PRs** | Search API returns 0 results for all PR queries | G4 metrics all zero. Category still scored (zero is a valid score, not missing data). |
| **Private repo / 404** | REST API returns 404 | Abort analysis. Return user-facing error: "Repository not found or is private." |
| **Extremely high star count** | `stargazers_count > 200` (triggers sampling) | Normal path; see Section 4.2 for mixed sampling strategy. |
| **New repo (< 7 days old)** | `created_at` within 7 days | Most period-based metrics will be near zero. Report displays "New repository" badge. Scoring proceeds normally. |

---

## 4. Star/Like Quality Weighting (Anti-Abuse)

### 4.1 Problem Statement

Fake stars are cheap (~$1 per 100 on black markets). A repo with 10,000 stars from bot accounts is not equivalent to 10,000 stars from active developers. We need to weight each star by the quality of the starring account.

### 4.2 Sampling Strategy

For repos with > 200 stars, we use a **mixed sampling strategy** to reduce systematic bias:

- **Recent sample**: 100 from most recent stargazers (detects current abuse patterns, bot surges)
- **Historical sample**: 100 from a random offset in the stargazer list (represents historical baseline, avoids recency bias from HN surges or bot attacks)
- **Total sample size**: `min(200, total_stars)`
- **API cost**: 2-4 GraphQL requests per repo (within budget)

**Implementation**:
1. Fetch the 100 most recent stargazers via GraphQL with `orderBy:{field:STARRED_AT, direction:DESC}`
2. To sample historical stargazers: compute a random cursor offset = `random(0, total_stars - 100)`, then fetch 100 stargazers starting from that offset using cursor pagination
3. Compute UQS separately for each group
4. Final `avg_UQS = (avg_UQS_recent + avg_UQS_historical) / 2`
5. UI displays both scores for transparency: "Recent stargazer quality: X, Historical stargazer quality: Y"

For repos with <= 200 stars, analyze all stargazers (no sampling needed).

### 4.3 User Quality Score (UQS)

For each sampled stargazer, compute:

```
UQS = 0.25 * A + 0.25 * F + 0.25 * R + 0.25 * C
```

Where (each normalized to 0-1):
- **A (Account Age)**: `min(1, account_age_days / 730)` — accounts < 30 days old score near 0
- **F (Followers)**: `min(1, log(1 + followers) / log(1 + 100))`
- **R (Repositories)**: `min(1, log(1 + public_repos) / log(1 + 30))`
- **C (Contributions)**: `min(1, log(1 + total_contributions) / log(1 + 500))`

### 4.4 Bot/Abuse Flags

Hard flags (UQS = 0 regardless of formula):
- Account age < 7 days at time of starring
- Zero repositories AND zero followers AND zero contributions
- Default avatar + no bio + no company (all three)

### 4.5 Quality-Weighted Star Score

```
QualityStarScore = total_stars * avg_UQS
```

Where `avg_UQS` is the averaged quality score from both sample groups (Section 4.2).

**Edge case**: When `sample_size = 0` (zero-star repo), `QualityStarScore = 0` (no adjustment attempted).

This produces an "effective star count" — e.g., 10,000 raw stars with average UQS of 0.3 = 3,000 effective stars.

### 4.6 Hugging Face Like Quality

HF API does not expose liker profiles. Approach:
- Use `trendingScore` as a proxy for organic popularity (HF's own anti-gaming)
- Cross-reference: if `likes` is very high but `downloads` is very low, apply a suspicion penalty:

```
HF_quality_factor = min(1.0, log(1 + downloads_30d) / log(1 + likes * 100))
QualityLikeScore = likes * max(0.3, HF_quality_factor)
```

Floor of 0.3 prevents complete zeroing for legitimately liked but rarely downloaded models.

---

## 5. Architecture Design

### 5.1 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 (App Router) | SSR, API routes, React Server Components |
| Language | TypeScript (strict) | Type safety across full stack |
| Styling | Tailwind CSS 4 + shadcn/ui | Utility-first, accessible components |
| Charts | Recharts | React-native, composable, good for dashboards |
| Storage | Redis (Upstash) | ALL caching and storage (API responses, reports, rate limits, progress) |
| Job Queue | Inngest | Serverless background jobs on Vercel |
| Validation | Zod | Runtime type validation for API inputs/outputs |
| HTTP Client | `ofetch` (unjs) | Lightweight, auto-retry, TypeScript-native |
| Deployment | Vercel | Zero-config Next.js deployment |

### 5.2 Data Flow

```
[User Input: URL] 
    -> [URL Parser & Validator]
    -> [Platform Router (GitHub | HuggingFace)]
    -> [POST /api/analyze] -> Creates analysis record, enqueues Inngest function
    -> [Client polls GET /api/status/[id] every 2s]
    -> [Inngest Function: "analysis.run"]
        -> [Analysis Orchestrator (state machine)]
            |-- [GitHub GraphQL Collector]  --> [Rate Limiter] --> GitHub API
            |-- [GitHub REST Collector]     --> [Rate Limiter] --> GitHub API
            |-- [GitHub Search Collector]   --> [Rate Limiter] --> GitHub Search API
            |-- [GitHub Scraper]            --> Dependents page
            |-- [HuggingFace Collector]     --> HF API
            |-- [HN Collector]             --> Algolia API
            |-- [Star Quality Analyzer]    --> GitHub GraphQL (stargazer sampling)
        -> [Scoring Engine]
            |-- [Metric Normalizer]
            |-- [Category Score Calculator]
            |-- [Composite Score Calculator]
        -> [Report stored in Redis]
    -> [Client receives completed report via polling]
    -> [UI Renderer (React)]
```

### 5.3 Directory Structure

```
/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Landing page with URL input
│   │   ├── report/
│   │   │   └── [id]/
│   │   │       └── page.tsx          # Report display page
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   │   └── route.ts          # POST: Start analysis (enqueue Inngest)
│   │   │   ├── report/
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts      # GET: Fetch completed report
│   │   │   └── status/
│   │   │       └── [id]/
│   │   │           └── route.ts      # GET: Poll analysis progress from Redis
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── lib/
│   │   ├── collectors/               # API data collectors
│   │   │   ├── github-graphql.ts
│   │   │   ├── github-rest.ts
│   │   │   ├── github-search.ts      # NEW: Search API for issues/PRs
│   │   │   ├── github-scraper.ts
│   │   │   ├── huggingface.ts
│   │   │   └── hackernews.ts
│   │   ├── scoring/                  # Scoring engine
│   │   │   ├── normalizer.ts
│   │   │   ├── star-quality.ts
│   │   │   ├── category-scores.ts
│   │   │   ├── composite-score.ts
│   │   │   └── config.ts             # Weights, thresholds
│   │   ├── orchestrator.ts           # Analysis state machine
│   │   ├── parsers/
│   │   │   └── url-parser.ts         # GitHub/HF URL parsing
│   │   ├── rate-limiter.ts
│   │   ├── cache.ts                  # Redis-only caching layer
│   │   ├── queue.ts                  # Concurrency gate + queue management
│   │   ├── retry.ts                  # Retry with backoff for 202s
│   │   └── types.ts                  # Shared TypeScript types
│   ├── inngest/
│   │   ├── client.ts                 # Inngest client config
│   │   └── functions/
│   │       └── analyze.ts            # Main analysis Inngest function
│   ├── components/
│   │   ├── url-input.tsx
│   │   ├── report/
│   │   │   ├── score-card.tsx
│   │   │   ├── category-breakdown.tsx
│   │   │   ├── metric-table.tsx
│   │   │   ├── trend-chart.tsx
│   │   │   ├── radar-chart.tsx
│   │   │   ├── star-quality-card.tsx
│   │   │   ├── social-buzz-card.tsx
│   │   │   ├── insufficient-data-badge.tsx   # NEW: Shows excluded categories
│   │   │   └── time-period-selector.tsx
│   │   └── ui/                       # shadcn/ui components
├── public/
├── .env.local                        # API keys (not committed)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### 5.4 Key Architectural Decisions

1. **Inngest + Polling for Progress**: All analyses run as Inngest background functions. The Inngest function writes progress percentage to Redis (`rpi:progress:{analysis_id}`). The client polls `GET /api/status/[id]` every 2 seconds to read progress from Redis. This avoids SSE, which fights Vercel's serverless model (no persistent connections, cold starts reset streams). Inngest handles retries, timeouts, and concurrency natively.

2. **Parallel API Collection**: All collectors run in parallel via `Promise.allSettled()` within the Inngest function. Individual collector failures don't block the report — missing data is marked as "unavailable" and excluded from scoring per Section 3.1 missing-data rules.

3. **Redis-Only Caching**: Redis (Upstash) handles ALL caching: completed reports, individual API responses, rate limit counters, and analysis progress. No relational `api_cache` table. Redis is faster and has native TTL support. Cache key format: `rpi:report:{platform}:{owner}/{repo}:{period}`.

4. **GitHub 202 Retry**: Stats endpoints return `202 Accepted` on first request while computing. Implement exponential backoff: wait 2s, 4s, 8s, max 3 retries.

5. **GitHub Search API for Time-Filtered Counts**: Issues opened/closed and PRs opened/merged use the GitHub Search API (`GET /search/issues?q=...`) instead of GraphQL `filterBy` or client-side filtering. This is the only way to accurately filter by `created:`, `closed:`, or `merged:` date ranges. The Search API has a separate rate limit (30 req/min authenticated).

### 5.5 Analysis Orchestrator

The orchestrator manages the lifecycle of a single analysis as a state machine within the Inngest function.

#### State Machine

```
queued -> collecting -> scoring -> complete
                                -> partial
                    -> failed
```

| State | Description |
|-------|-------------|
| `queued` | Analysis record created, waiting for Inngest to pick up |
| `collecting` | Collectors running in parallel |
| `scoring` | All collectors finished (or timed out), scoring engine computing |
| `complete` | All categories have sufficient data, final score computed |
| `partial` | >50% of categories have sufficient data, but some collectors failed. Report generated with "insufficient data" badges on affected categories. |
| `failed` | <50% of categories have sufficient data, OR critical error (repo not found, auth failure). No composite score produced. |

#### Progress Percentage Mapping

Each collector phase maps to a progress range. The orchestrator writes the current percentage to Redis after each phase completes.

| Phase | Progress Range | Notes |
|-------|---------------|-------|
| GitHub GraphQL (batched query) | 0-15% | Fundamentals, commits, discussions |
| GitHub Search API (issues + PRs) | 15-30% | 4-5 search queries for G3/G4 |
| GitHub REST + Scraper | 30-45% | Stats endpoints (with 202 retry), dependents |
| HuggingFace API | 45-55% | Model/dataset info, commits, discussions |
| HN Collector | 55-65% | Algolia search |
| Star Quality Analyzer | 65-80% | Stargazer sampling (2-4 GraphQL requests) |
| Scoring Computation | 80-95% | Normalization, category scores, composite |
| Report Assembly + Cache | 95-100% | Write to DB + Redis cache |

#### Timeouts

- **Per-collector timeout**: 15 seconds. If a collector exceeds this, it is marked as failed and its metrics are set to `null` (unavailable). The orchestrator continues with remaining collectors.
- **Total analysis timeout**: 60 seconds (aligned with Vercel Pro function timeout limit). Inngest enforces this; if exceeded, the analysis transitions to `partial` or `failed` based on how many categories have data.

### 5.6 Global Concurrency Gate

The system enforces global concurrency limits to prevent overloading GitHub's rate limits, since the 270 analyses/hour budget is global across all users.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Max concurrent analyses | 5 | Configurable via `MAX_CONCURRENT_ANALYSES` env var |
| Queue implementation | Redis-backed FIFO | Uses Inngest's built-in concurrency controls (`concurrency: { limit: 5 }`) |
| Max queue depth | 20 pending | When exceeded, return HTTP 503 with `Retry-After` header and estimated wait time |
| Queue position tracking | Redis sorted set `rpi:queue` | Client poll response includes `{ status: "queued", position: 3, estimatedWait: "~30s" }` |

**Implementation**: Inngest natively supports concurrency limits on function definitions. The `POST /api/analyze` endpoint checks Redis for current queue depth before enqueuing. If depth > 20, it returns 503 immediately.

```typescript
// inngest/functions/analyze.ts (conceptual)
export const analyzeRepo = inngest.createFunction(
  {
    id: "analyze-repo",
    concurrency: {
      limit: parseInt(process.env.MAX_CONCURRENT_ANALYSES ?? "5"),
    },
  },
  { event: "analysis/run" },
  async ({ event, step }) => { /* orchestrator logic */ }
);
```

---

## 6. API Integration Details

### 6.1 Authentication & Rate Limits

| API | Auth Method | Rate Limit | Strategy |
|-----|-----------|------------|----------|
| GitHub REST | PAT in `Authorization: Bearer {token}` header | 5,000 req/hr (authenticated) | Token rotation if multiple PATs available |
| GitHub GraphQL | Same PAT | 5,000 points/hr | Batch queries, monitor `rateLimit` field |
| GitHub Search | Same PAT | 30 req/min (authenticated) | Separate from core rate limit; budget carefully |
| Hugging Face | `Authorization: Bearer {HF_TOKEN}` | 1,000 req/5min (free user) | Cache aggressively, 500ms delay between requests |
| HN Algolia | None | 10,000 req/hr | Generous; no special handling needed |

### 6.2 Per-Analysis API Budget

For a single repository analysis:

| Collector | Requests | Type | Notes |
|-----------|----------|------|-------|
| GitHub GraphQL (main batch) | 1-2 | GraphQL (50-100 pts) | Fundamentals, commits, discussions, metadata |
| GitHub GraphQL (stargazers — recent) | 1 | GraphQL (10-20 pts) | 100 most recent stargazers |
| GitHub GraphQL (stargazers — historical) | 1-2 | GraphQL (10-20 pts) | 100 from random offset |
| GitHub Search (issues opened) | 1 | Search API | G3.1 |
| GitHub Search (issues closed) | 1 | Search API | G3.2 |
| GitHub Search (PRs opened) | 1 | Search API | G4.1 |
| GitHub Search (PRs merged) | 1 | Search API | G4.2 (also provides data for G4.4/G4.5) |
| GitHub REST (stats) | 3 | REST | participation, code_frequency, community profile |
| GitHub REST (releases) | 1 | REST | Latest releases |
| GitHub scraper (dependents) | 1 | HTTP | Single page fetch |
| HuggingFace | 2-3 | REST | Model info + commits + discussions |
| HN Algolia | 1 | REST | Single search |
| **Totals** | **~16-19 REST** | **~70-140 GraphQL pts** | **4 Search API req** |

**Throughput calculation**:
- GitHub REST: 5,000/hr / 19 = ~263 analyses/hr
- GitHub GraphQL: 5,000 pts/hr / 140 = ~35 analyses/hr (binding constraint)
- GitHub Search: 30/min = 1,800/hr / 4 = ~450 analyses/hr
- **Effective capacity**: ~35 analyses/hr (GraphQL-bound). With concurrency limit of 5 and typical analysis time of ~15-30s, practical throughput is ~10-20/hr which is well within all limits.

### 6.3 Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: 3,
  baseDelay: 2000,           // 2 seconds
  maxDelay: 30000,           // 30 seconds
  backoffMultiplier: 2,
  retryableStatuses: [202, 429, 500, 502, 503],
}
```

For `429 Too Many Requests`: read `Retry-After` header, wait that duration.
For `202 Accepted` (GitHub stats): retry after `baseDelay * backoffMultiplier^attempt`.

### 6.4 Environment Variables

```
# Required
GITHUB_TOKEN=ghp_...              # Personal Access Token (repo scope optional for traffic)
NEXT_PUBLIC_APP_URL=https://...

# Recommended
HF_TOKEN=hf_...                   # Hugging Face token (higher rate limits)

# Infrastructure
REDIS_URL=redis://...
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...

# Optional
GITHUB_TOKEN_2=ghp_...           # Additional PAT for rotation
GITHUB_TOKEN_3=ghp_...
MAX_CONCURRENT_ANALYSES=5        # Global concurrency limit (default: 5)

# Phase 8 (deferred — not needed for v1)
# YOUTUBE_API_KEY=AIza...
# STACKOVERFLOW_KEY=...
```

---

## 7. Data Model

### 7.1 Redis Cache Keys

Redis is the **sole caching layer** (no relational `api_cache` table). All cache operations go through Redis.

```
rpi:report:{platform}:{owner}/{repo}:{period}   -> Full report JSON (TTL: 1 hour)
rpi:api:{source}:{endpoint_hash}                  -> API response (TTL: 15 minutes)
rpi:rate:{source}                                 -> Rate limit counter (TTL: matches rate window)
rpi:rate:search                                   -> Search API rate counter (TTL: 60 seconds)
rpi:progress:{analysis_id}                        -> Progress percentage + stage label (TTL: 10 minutes)
rpi:queue                                         -> Sorted set of queued analysis IDs (no TTL, managed by orchestrator)
```

---

## 8. UI/UX Design

### 8.1 Pages

#### Page 1: Landing / Input (`/`)

- Hero section: Title, tagline ("Measures how actively a repository is being used. 50+ metrics with GitHub star abuse correction.")
- Single URL input field with placeholder examples
- Platform auto-detection badge (GitHub/HF icon appears on valid URL)
- Time period selector (pill buttons: 1W | 1M | 3M | 6M | 1Y, default 3M)
- "Analyze" button
- Recent analyses list (last 10, from DB)

#### Page 2: Analysis Progress (`/report/[id]` — loading state)

- Repository/model card (name, description, avatar)
- Progress bar with stage labels (driven by polling `GET /api/status/[id]` every 2 seconds):
  - "Collecting GitHub metrics..." (0-30%)
  - "Fetching external signals..." (30-55%)
  - "Analyzing star quality..." (55-80%)
  - "Computing scores..." (80-100%)
- If queued: "Position in queue: #3 — estimated wait: ~30s"
- Poll-based updates (no SSE)

#### Page 3: Report (`/report/[id]` — complete state)

Layout (top to bottom):

**Section A: Header**
- Repository name + platform icon + URL link
- Large composite score (0-100) with color coding:
  - 80-100: Green ("Highly Active")
  - 60-79: Blue ("Active")
  - 40-59: Yellow ("Moderate")
  - 20-39: Orange ("Low Activity")
  - 0-19: Red ("Minimal Activity")
- If `partial` status: banner indicating "Some data sources were unavailable — score based on available data"
- Time period selector (switch without re-fetch if data cached)

**Section B: Category Radar Chart**
- 6-axis radar chart showing category scores (only axes with sufficient data)
- Axes: Activity, Community, Adoption, Popularity, Health, Social Buzz
- Categories with insufficient data shown as dashed/grayed axis
- Filled area with opacity

**Section C: Category Breakdown Cards (Grid: 2x3 or 3x2)**
Each card shows:
- Category name + score (0-100) + color bar
- Top 3 contributing metrics with values
- Trend indicator (arrow up/down/flat vs previous period if data available)
- "Insufficient data" badge if category excluded (with tooltip explaining why)

**Section D: Star/Like Quality Analysis**
- Quality-weighted vs raw star count (side-by-side)
- Pie chart: account quality distribution (High/Medium/Low/Suspicious)
- Recent vs Historical quality scores displayed separately for transparency
- Star burst detection alert (if detected)
- Sample size disclosure ("Based on 200 stargazers: 100 recent + 100 historical")

**Section E: Social Buzz Panel**
- HN: Story count, total points, most upvoted story link
- "Reddit, Stack Overflow, and YouTube coming soon" placeholder for v1

**Section F: Detailed Metrics Table**
- Expandable accordion by category
- Columns: Metric Name | Raw Value | Normalized (0-1) | Weight | Contribution to Score
- Unavailable metrics shown as "N/A" with explanation
- Sortable by any column

**Section G: Methodology Footer**
- Collapsible section explaining the scoring formula
- Links to data sources
- Timestamp of analysis

### 8.2 Visualization Components

| Component | Library | Purpose |
|-----------|---------|---------|
| Radar Chart | Recharts `RadarChart` | Category overview |
| Score Gauge | Custom SVG (arc) | Composite score display |
| Bar Charts | Recharts `BarChart` | Metric comparisons |
| Line Charts | Recharts `LineChart` | Commit activity over 52 weeks |
| Pie Chart | Recharts `PieChart` | Star quality distribution |
| Progress Bar | shadcn/ui `Progress` | Analysis progress |
| Data Table | shadcn/ui `Table` + `Collapsible` | Detailed metrics |

### 8.3 Responsive Design

- Desktop: Full 3-column layout for category cards, side-by-side comparisons
- Tablet: 2-column card layout, stacked charts
- Mobile: Single column, horizontally scrollable tables, radar chart scales down

---

## 9. Development Phases

### Phase 1: Foundation (Week 1-2)

**Deliverables:**
- [ ] Project scaffolding: Next.js 15 + TypeScript + Tailwind + shadcn/ui
- [ ] URL parser: GitHub and HF URL validation and parsing
- [ ] Rate limiter + retry utility with 202 handling
- [ ] Redis cache layer (sole caching solution — no relational cache table)
- [ ] Inngest client setup + analyze function skeleton
- [ ] Concurrency gate: Redis-backed queue with depth limit
- [ ] Landing page with URL input form

**Acceptance Criteria:**
- `pnpm dev` starts without errors
- URL parser correctly parses: `github.com/org/repo`, `github.com/user/repo`, `huggingface.co/org/model`, `huggingface.co/datasets/org/name`
- Rate limiter correctly enforces per-source limits (including 30 req/min for Search API)
- Inngest function triggers and writes progress to Redis
- Queue rejects with 503 when depth exceeds 20

### Phase 2: GitHub Collectors (Week 3-4)

**Deliverables:**
- [ ] GitHub GraphQL collector: commits, discussions, stargazer profiles (mixed sampling: 100 recent + 100 historical)
- [ ] GitHub Search API collector: issues opened/closed, PRs opened/merged with `created:`/`closed:`/`merged:` qualifiers
- [ ] GitHub REST collector: stats/participation, stats/code_frequency, community/profile, releases
- [ ] GitHub scraper: dependents count from HTML
- [ ] Star quality analyzer: UQS computation with mixed sampling, burst detection
- [ ] Edge case handling: zero stars, no releases, discussions disabled, empty repo, issues disabled (per Section 3.6)
- [ ] Integration tests for each collector with recorded fixtures

**Acceptance Criteria:**
- GraphQL collector returns G2, G8, G9 metrics for `facebook/react`
- Search API collector returns accurate G3 (issues) and G4 (PR) counts for `facebook/react` using `created:` and `merged:` qualifiers
- REST collector handles 202 responses with retry
- Scraper extracts correct dependents count for `expressjs/express`
- Star quality analyzer produces both recent and historical UQS scores
- Zero-star repo returns `QualityStarScore = 0` without error
- Repo with issues disabled returns G3 category as `null` (insufficient data)
- Empty repo (null `defaultBranchRef`) returns commit count = 0 without error
- All collectors handle errors gracefully (return partial data, not throw)
- Each collector respects its 15-second timeout

### Phase 3: HuggingFace + HN Collector (Week 5)

**Deliverables:**
- [ ] HuggingFace collector: model/dataset info, commits, discussions
- [ ] HackerNews collector: story search with date filtering

**Acceptance Criteria:**
- HF collector returns all H1-H5 metrics for `meta-llama/Llama-3.1-8B`
- HN collector finds stories for `github.com/facebook/react`
- HN collector returns zero gracefully for unknown/obscure repos
- Both collectors complete within 15-second per-collector timeout

### Phase 4: Scoring Engine (Week 6)

**Deliverables:**
- [ ] Metric normalizer with configurable thresholds
- [ ] Category score calculator with configurable weights and missing-data handling
- [ ] Composite score calculator with category exclusion/re-weighting
- [ ] `recency_factor` application (post-normalization, pre-averaging)
- [ ] Score configuration file (weights, thresholds, formulas)
- [ ] Unit tests for scoring with known inputs/outputs
- [ ] Calibration verification against reference repos (see acceptance criteria)

**Acceptance Criteria:**
- Normalizer: `log(1 + 50000) / log(1 + 50000) = 1.0` for stars at threshold
- Normalizer: `log(1 + 100) / log(1 + 50000) = ~0.43` for 100 stars
- Category scores correctly weighted-average their available metrics only
- When a metric is `null`, it is excluded from both numerator and denominator
- When <50% of a category's metrics are available, category is excluded and remaining categories re-weighted
- Composite score is weighted average of included category scores only
- Scores are deterministic: same input always produces same output
- **Calibration test**: Run scoring against 20+ repos spanning 4 tiers:
  - 5 very popular (e.g., react, tensorflow, kubernetes, vscode, rust)
  - 5 moderately active (e.g., mid-size projects with 1K-10K stars)
  - 5 low-activity (e.g., small/niche projects with <500 stars)
  - 5 archived/dead (e.g., repos with no commits in 1+ year)
- **Verify score ordering**: very popular > moderate > low > archived
- **Threshold tuning**: If >80% of repos land within a 20-point range, adjust `max_i` thresholds to spread the distribution

### Phase 5: API Orchestrator + Report Generation (Week 7)

**Deliverables:**
- [ ] Analysis orchestrator: state machine (`queued -> collecting -> scoring -> complete | partial | failed`)
- [ ] Inngest function: full analysis pipeline with per-collector timeouts (15s) and total timeout (60s)
- [ ] Polling progress endpoint: `GET /api/status/[id]` reads progress from Redis
- [ ] Report API: `POST /api/analyze` triggers analysis, `GET /api/report/[id]` fetches results
- [ ] Queue position tracking in status endpoint
- [ ] Report data assembly (raw metrics + scores + metadata + excluded categories)

**Acceptance Criteria:**
- Full analysis of `facebook/react` completes in < 30 seconds
- Status endpoint returns progress percentage and stage label, updated at each collector phase
- Failed collectors don't block report generation; report transitions to `partial` state
- Completed reports are cached in Redis for 1 hour
- Inngest function completes even if client disconnects
- Queue position is visible when analysis is queued
- 503 returned when queue depth > 20
- Concurrent analyses limited to 5

### Phase 6: Report UI (Week 8-9)

**Deliverables:**
- [ ] Score gauge component (composite score)
- [ ] Radar chart (category overview, with grayed axes for insufficient data)
- [ ] Category breakdown cards (with "insufficient data" badges)
- [ ] Star quality analysis card (showing recent vs historical UQS separately)
- [ ] Social buzz panel (HN only for v1, with "coming soon" placeholders)
- [ ] Detailed metrics table (expandable, N/A for unavailable metrics)
- [ ] Time period selector (re-fetches data)
- [ ] Analysis progress page with polling updates + queue position
- [ ] Responsive layout (mobile/tablet/desktop)

**Acceptance Criteria:**
- Report page renders all sections with real data
- Radar chart displays axes correctly, graying out insufficient-data categories
- Score gauge color-codes based on score range
- Metrics table shows raw, normalized, weighted values; unavailable metrics show "N/A"
- Star quality card shows both recent and historical sample quality scores
- Time period selector triggers new analysis if not cached
- Page is usable on 375px mobile viewport
- Partial reports display correctly with banner explaining missing data

### Phase 7: Polish & Launch Prep (Week 10)

**Deliverables:**
- [ ] Error states and empty states for all components
- [ ] Loading skeletons during data fetch
- [ ] SEO: meta tags, Open Graph for report sharing
- [ ] Rate limiting on the analyze endpoint (prevent abuse)
- [ ] Input validation and error messages
- [ ] Favicon, OG image, landing page copy
- [ ] Environment variable validation on startup
- [ ] Deployment to Vercel + Supabase + Upstash

**Acceptance Criteria:**
- Invalid URLs show clear error messages
- Network errors show retry option
- Report pages have correct OG tags for social sharing
- Analyze endpoint rate-limited to 10 requests/minute per IP
- Application starts with clear error if required env vars missing
- Production deployment accessible and functional

### Phase 8: Social Collector Expansion (Post-Launch)

**Deliverables:**
- [ ] Reddit collector: post search with rate limiting (6s interval)
- [ ] Stack Overflow collector: tag/keyword search
- [ ] YouTube collector: video search + stats
- [ ] Update G-Social / H-Social within-category weights: HN 3, Reddit 2, SO 2, YouTube 1
- [ ] Add Reddit, SO, YouTube sections to Social Buzz panel UI

**Acceptance Criteria:**
- Reddit collector respects 6-second interval between requests
- All social collectors return zero gracefully for unknown/obscure repos
- Updated social weights produce reasonable composite changes (not >5% swing for typical repos)
- YouTube/SO API keys only required when Phase 8 collectors are enabled

---

## 10. Social Buzz Integration — Detailed Design

### 10.1 Query Construction

The key challenge is mapping a repository identity to search queries across different platforms.

```typescript
interface SocialQuery {
  // Primary: exact URL match
  urlQuery: string;        // "github.com/facebook/react"
  // Secondary: project name (broader, may have false positives)
  nameQuery: string;       // "react" (only used if URL query returns 0 results AND name is unique enough)
  // HF-specific
  hfQuery?: string;        // "huggingface.co/meta-llama/Llama-3.1-8B"
}
```

**Name uniqueness heuristic**: Only use `nameQuery` fallback if the repo name is >= 5 characters and not a common English word. This avoids false positives for repos named "app", "core", "test", etc.

### 10.2 Hacker News (v1 — Active)

```
GET https://hn.algolia.com/api/v1/search?query={urlQuery}&tags=story&hitsPerPage=100&numericFilters=created_at_i>{sinceUnix}
```

Response fields used:
- `nbHits`: total story count
- `hits[].points`: upvotes per story
- `hits[].num_comments`: discussion depth
- `hits[].objectID`: link to `https://news.ycombinator.com/item?id={objectID}`
- `hits[].created_at_i`: for time filtering

**Scoring formula:**
```
HN_engagement = SUM(points * 1.0 + num_comments * 1.5) for all matching stories
```
Comments weighted higher than points because they indicate deeper engagement.

### 10.3 Composite Social Score (v1)

For v1 (HN only), the social score IS the HN engagement score:

```
Social_raw = HN_engagement

Social_normalized = log(1 + Social_raw) / log(1 + 2000)   // 2000 = HN saturation threshold

Social_score = Social_normalized * 100
```

When Phase 8 collectors are added, the formula expands to:
```
Social_raw = (HN_engagement * 3 + Reddit_engagement * 2 + SO_engagement * 2 + YT_engagement * 1) / 8
Social_normalized = log(1 + Social_raw) / log(1 + 50000)
```

### 10.4 Deferred Platforms (Phase 8)

> **Superseded for collector scaffolding by `.omc/plans/social-collectors-darklaunch.md` (v3).** Reddit / SO / YouTube collectors are implemented and dark-launched as of this iteration. Activation (registering metric keys in `*_METRICS`, surfacing in UI, assigning weights) remains future work. Optional credentials documented in `README.md → Optional Social Collector Credentials`.

The following designs are prepared but not implemented in v1.

#### Reddit

```
GET https://www.reddit.com/search.json?q=url:github.com/{owner}/{repo}&sort=new&limit=100&t={period}
```

Period mapping: `t=week`, `t=month`, `t=year`, `t=all`

Response fields used:
- `data.children[].data.score`: net upvotes
- `data.children[].data.num_comments`: discussion count
- `data.children[].data.subreddit`: distribution shows reach breadth

**Headers required:**
```
User-Agent: RepoPopIndex/1.0 (contact: admin@repopopindex.com)
```

**Scoring formula:**
```
Reddit_engagement = SUM(score * 1.0 + num_comments * 2.0) + unique_subreddits * 50
```
Subreddit diversity bonus: appearing in 5 different subreddits is a stronger signal than 5 posts in one.

#### Stack Overflow

```
GET https://api.stackexchange.com/2.3/search/advanced?tagged={tag}&fromdate={sinceUnix}&site=stackoverflow&filter=total&key={key}
```

If tag doesn't exist, fall back to:
```
GET https://api.stackexchange.com/2.3/search/advanced?q={repo_name}&fromdate={sinceUnix}&site=stackoverflow&filter=!nNPvSNVZJS&key={key}
```

**Tag mapping:** Repository name lowercase, e.g., `pytorch`, `react`, `next.js`. For HF models, use library name.

**Scoring formula:**
```
SO_engagement = question_count * 10 + SUM(view_count) / 1000 + SUM(score)
```

#### YouTube

```
GET https://www.googleapis.com/youtube/v3/search?part=snippet&q={repo_name}+programming+tutorial&type=video&maxResults=10&publishedAfter={isoDate}&key={key}
```

Then for top 10 video IDs:
```
GET https://www.googleapis.com/youtube/v3/videos?part=statistics&id={id1},{id2},...,{id10}&key={key}
```

**Rate limit**: 100 units per search, 10,000 units/day. Limit to 1 search + 1 video stats call = 101 units.

**Scoring formula:**
```
YT_engagement = video_count * 5 + SUM(viewCount for top 10) / 100
```

---

## ADR (Architectural Decision Record)

### Decision
Build RepoPopIndex as a Next.js 15 full-stack application with Redis (sole storage layer) and Inngest for background jobs, using a composite scoring methodology inspired by OpenSSF Criticality Score. Use GitHub Search API for time-filtered issue/PR counts. Use polling (not SSE) for progress updates.

### Drivers
1. Rate limit economics demand GraphQL-first data collection for non-time-filtered data, with Search API for accurate time-window filtering on issues/PRs
2. No historical APIs exist — must compute trends from timestamped events and snapshots
3. Single-developer/small-team context favors monolith simplicity over microservice flexibility
4. Vercel serverless model requires polling over SSE for reliable progress streaming

### Alternatives Considered
1. **Separate Frontend + Backend** (Option B above): Rejected for v1 due to increased operational complexity without corresponding benefit at launch scale. Remains viable for v2 if scaling demands increase.
2. **Static Site with Client-Side API Calls**: Rejected because it exposes API tokens to the client and cannot cache or rate-limit effectively.
3. **CLI Tool Only**: Rejected because the visual report with charts is a core requirement and web distribution reaches more users.
4. **SSE for Progress Streaming**: Rejected because Vercel serverless functions terminate after response — SSE requires persistent connections that fight the serverless model. Polling every 2s with Redis-backed progress is simpler and more reliable.
5. **GraphQL `filterBy:{since:}` for Issue/PR Time Filtering**: Rejected because `since` filters by `updatedAt`, not `createdAt`. Issues commented on recently but opened years ago would inflate counts. Search API with `created:` qualifiers is accurate.
6. **Relational `api_cache` Table for Caching**: Rejected in favor of Redis-only caching. Redis is faster, has native TTL support, and avoids the complexity of managing cache in two systems.

### Why Chosen
Next.js provides the best DX-to-capability ratio for a full-stack web app: SSR for SEO on report pages, API routes for backend logic, React for interactive charts, and Vercel for zero-config deployment. The Inngest integration solves the serverless timeout constraint without requiring a dedicated worker server. Redis-only caching simplifies the data layer. GitHub Search API provides the accurate time-window filtering that GraphQL lacks for issues and PRs.

### Consequences
- **Positive**: Fast development velocity, single codebase, excellent TypeScript integration, free Vercel tier for initial launch, accurate time-filtered metrics
- **Negative**: Vercel vendor coupling, function timeout requires Inngest workaround, Search API has tighter rate limit (30 req/min) than core API, monolith may need decomposition at scale
- **Neutral**: Redis is the sole storage layer — all state is keyed in Redis with appropriate TTLs

### Follow-ups
- Monitor analysis completion times; if consistently > 30s, evaluate moving collectors to a dedicated worker service
- After launch, gather user feedback on whether comparison features (side-by-side repos) are needed — this would inform database schema evolution
- Evaluate adding npm/PyPI download data as additional adoption signals in Phase 8+
- Consider periodic snapshot jobs (cron) for tracking score trends over time
- Monitor Search API rate limit consumption; if it becomes a bottleneck, consider caching search results more aggressively or reducing query count

---

## Appendix A: GitHub GraphQL Batched Query

A single batched query that collects non-time-filtered GitHub metrics in one request. Time-filtered issue/PR counts use the Search API instead (see Sections 2.1 G3/G4).

```graphql
query RepoPopIndex($owner: String!, $name: String!, $since: GitTimestamp!) {
  repository(owner: $owner, name: $name) {
    # G1: Fundamentals
    stargazerCount
    forkCount
    watchers { totalCount }
    createdAt
    pushedAt
    
    # G2: Commits
    defaultBranchRef {
      target {
        ... on Commit {
          history(since: $since) { totalCount }
        }
      }
    }
    
    # G3/G4: Total counts only (time-filtered counts use Search API)
    allIssues: issues { totalCount }
    allPRs: pullRequests { totalCount }
    mergedPRs: pullRequests(states: MERGED) { totalCount }
    
    # G9: Advanced
    discussions { totalCount }
    licenseInfo { spdxId name }
    
    # G7: Community indicators
    hasIssuesEnabled
    hasWikiEnabled
    hasDiscussionsEnabled
    codeOfConduct { name }
    
    # Repo metadata
    description
    homepageUrl
    primaryLanguage { name color }
    repositoryTopics(first: 10) {
      nodes { topic { name } }
    }
  }
  rateLimit {
    cost
    remaining
    resetAt
  }
}
```

**Note**: The `issues(filterBy:{since:})` fields that were in v1.0 of this plan have been removed. GitHub's `since` filter operates on `updatedAt`, not `createdAt`, which produces incorrect counts for time-window analysis. Time-filtered issue and PR counts now use the GitHub Search API with `created:>DATE` and `merged:>DATE` qualifiers (see Sections 2.1 G3 and G4).

**Estimated cost**: 1-3 points (depending on node counts).

## Appendix B: HuggingFace API Response Shape

```json
// GET https://huggingface.co/api/models/meta-llama/Llama-3.1-8B
{
  "id": "meta-llama/Llama-3.1-8B",
  "modelId": "meta-llama/Llama-3.1-8B",
  "likes": 423,
  "downloads": 2847561,
  "downloadsAllTime": 18234567,
  "trendingScore": 42.5,
  "tags": ["transformers", "pytorch", "llama", "text-generation"],
  "library_name": "transformers",
  "pipeline_tag": "text-generation",
  "inference": "warm",
  "inferenceProviderMapping": { "hf-inference": {}, "together": {}, "fireworks": {} },
  "spaces": ["space1", "space2", "..."],
  "cardData": { "license": "llama3.1", "datasets": ["..."], "...": "..." },
  "siblings": ["..."],
  "createdAt": "2024-07-01T00:00:00.000Z",
  "lastModified": "2024-12-15T00:00:00.000Z"
}
```

## Appendix C: Environment Setup Commands

```bash
# Initialize project
pnpm create next-app@latest repopopindex --typescript --tailwind --eslint --app --src-dir
cd repopopindex

# Install dependencies
pnpm add @upstash/redis
pnpm add inngest
pnpm add recharts
pnpm add zod
pnpm add ofetch
pnpm add cheerio                               # For HTML scraping (dependents)

# shadcn/ui
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input card table badge progress collapsible tabs

# Dev tools
pnpm add -D @types/node
```
