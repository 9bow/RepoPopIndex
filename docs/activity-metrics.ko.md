# 활성도 지표 레퍼런스

이 문서는 **repopopindex**가 **GitHub** 및 **Hugging Face**의 저장소 활성도를 측정하는 전체 파이프라인을 기술합니다. 어떤 원시 신호(raw signal)를 수집하고, 어떻게 정규화·가중치를 부여하며, 최종 종합 점수(composite score)가 어떻게 산출되는지를 다룹니다.

본문의 모든 코드 참조는 저장소 루트를 기준으로 한 상대 경로입니다.

---

## 1. 파이프라인 개요

```
HTTP POST /api/analyze
  └─► Inngest event "analysis/run"
        └─► runAnalysis()                       src/lib/orchestrator.ts
              ├─ collect (Promise.allSettled)   src/lib/collectors/*
              │    ├─ github-graphql
              │    ├─ github-rest
              │    ├─ github-search
              │    ├─ github-scraper (dependents)
              │    ├─ star-quality (샘플링된 stargazers)
              │    ├─ huggingface
              │    └─ hackernews (공용 소셜 버즈)
              ├─ persist → rawMetrics
              ├─ computeScores()                src/lib/scoring/*
              │    ├─ 정규화 (log / linear, inverse)
              │    ├─ 누적(cumulative) 지표에 RECENCY_FACTOR 적용
              │    ├─ 지표별 가중치 적용
              │    ├─ 카테고리별 집계 (insufficiency 게이트)
              │    └─ 카테고리 → 종합 점수 집계 (0–100)
              └─ persist → scores
```

타임아웃: 각 수집기(collector)의 마감은 15초(`COLLECTOR_TIMEOUT`), 전체 분석은 60초(`TOTAL_TIMEOUT`)입니다. 동시 실행은 `MAX_CONCURRENT_ANALYSES`(기본값 5)로 상한이 걸립니다.

레이트 리밋은 `src/lib/rate-limiter.ts`에 정의되어 있으며 Upstash Redis를 백엔드로 사용합니다:

| Source | Limit |
|---|---|
| `github-rest` | 5000 req / 3600 s |
| `github-graphql` | 5000 req / 3600 s |
| `github-search` | 30 req / 60 s |
| `huggingface` | 1000 req / 300 s |
| `hackernews` | 10000 req / 3600 s |

재시도(`src/lib/retry.ts`): 최대 3회, 지수 백오프(2초 → 30초), 429 응답의 `Retry-After` 헤더를 준수합니다.

---

## 2. 저장 스키마(Storage Schema)

소스: `src/db/schema.ts`

### `analyses`
하나의 평가 실행(run)을 추적합니다.

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | uuid PK | |
| `platform` | enum | `github` \| `huggingface` |
| `owner`, `repo` | text | |
| `period` | enum | `1w` \| `1m` \| `3m` \| `6m` \| `1y` (기본값 `3m`) |
| `status` | enum | `queued` \| `collecting` \| `scoring` \| `complete` \| `partial` \| `failed` |
| `inputUrl`, `error`, `createdAt`, `completedAt` | | |

### `rawMetrics`
한 번의 실행에서 수집된 지표 하나당 한 행(row)이 저장됩니다.

| 컬럼 | 비고 |
|---|---|
| `analysisId` | FK → `analyses.id` (cascade) |
| `source` | `github-graphql`, `github-rest`, `github-search`, `github-scraper`, `star-quality`, `huggingface`, `hackernews` |
| `category` | `G1`..`G8`, `H1`..`H5`, `S1` |
| `metricKey` | 예: `stars`, `G2.4`, `downloads` |
| `rawValue` | `real`, nullable |
| `rawJson` | `jsonb`, 복합 페이로드용 (예: UQS 하위 점수) |

### `scores`
실행의 최종 계산 결과.

| 컬럼 | 비고 |
|---|---|
| `compositeScore` | 0–100 |
| `categoryScores` | `Record<categoryId, { name, score, maxScore:100, metrics, insufficient, reason? }>` |
| `metricScores` | `Record<metricKey, { raw, normalized, weighted }>` |
| `excludedCategories` | 데이터 부족으로 제외된 카테고리 ID 배열 |
| `starQualityFactor`, `starQualityRecent`, `starQualityHistorical`, `starBurstDetected` | 빠른 조회를 위해 G8에서 비정규화(denormalize)해 저장 |
| `hnData` | `{ storyCount, totalPoints, totalComments, topStory, engagement }` |

---

## 3. GitHub 데이터 수집

### 3.1 GraphQL — `src/lib/collectors/github-graphql.ts`

엔드포인트: `POST https://api.github.com/graphql`, `GITHUB_TOKEN`으로 bearer 인증.
두 개의 쿼리가 존재합니다 — `QUERY`(discussions 포함)와 `QUERY_NO_DISCUSSIONS`(fallback).

방출(Emit)되는 지표:

| metricKey | Category | 소스 필드 |
|---|---|---|
| `stars` | G1 | `stargazerCount` |
| `forks` | G1 | `forkCount` |
| `watchers` | G1 | `watchers.totalCount` |
| `G2.5` | G2 | `defaultBranchRef.target.history.totalCount` (`period` 이후) |
| `open_issues` | G3 (메타데이터) | `issues(states:OPEN).totalCount` |
| `open_prs` | G4 (메타데이터) | `pullRequests(states:OPEN).totalCount` |
| `discussions_count` | G3 (메타데이터) | `discussions.totalCount` |

또한 메타데이터로 수집되지만 채점에는 사용되지 않는 항목: `createdAt`, `pushedAt`, `description`, `primaryLanguage.name`, `licenseInfo.spdxId`, `hasIssuesEnabled`, `hasDiscussionsEnabled`.

### 3.2 REST — `src/lib/collectors/github-rest.ts`

| 엔드포인트 | 파생 지표 |
|---|---|
| `/repos/{o}/{r}/stats/participation` | `G2.1` (`all[]` 합), `G2.2` (외부 기여 비율 = `1 − sumOwner/sumAll`), `G2.6` (활동 모멘텀 = `recent4/prior4`) |
| `/repos/{o}/{r}/stats/code_frequency` | `G2.3_additions`, `G2.3_deletions` (`period` 이후) |
| `/repos/{o}/{r}/community/profile` | `G7.1` (`health_percentage`), `G7.2` CONTRIBUTING, `G7.3` code_of_conduct, `G7.4` README |
| `/repos/{o}/{r}/releases?per_page=100` | `G5.1` 기간 내 릴리즈 수, `G5.2` 릴리즈 간 평균 일수, `G5.3` 에셋 다운로드 합계 |
| `/repos/{o}/{r}/contributors?per_page=1&anon=true` | `G2.4` 전체 기여자 수 (`Link: rel="last"` 파싱) |
| `/repos/{o}/{r}/tags?per_page=1` | `G5.4` 태그 수 (페이지네이션 링크로 계산) |

### 3.3 Search — `src/lib/collectors/github-search.ts`

엔드포인트: `GET https://api.github.com/search/issues`

쿼리 (`since = 기간 시작 시점`):
- `repo:o/r+type:issue+created:>{since}` → `G3.1`
- `repo:o/r+type:issue+closed:>{since}`   → `G3.2`
- `repo:o/r+type:pr+created:>{since}`     → `G4.1`
- `repo:o/r+type:pr+merged:>{since}`      → `G4.2`

메모리에서 파생 계산:
- `G3.3` = `G3.2 / G3.1` (이슈 종료율, 0–1)
- `G4.3` = `G4.2 / G4.1` (PR 머지율, 0–1)
- `G4.4` = 머지된 PR 중 고유 작성자 수
- `G4.5` = **중앙값(median)** 머지 소요 일수 (`merged_at − created_at`)

### 3.4 Dependents 스크래퍼 — `src/lib/collectors/github-scraper.ts`

`https://github.com/{o}/{r}/network/dependents`의 HTML을 스크래핑합니다. 정규식 `(\d[\d,]*)\s*Repositories`로 추출 → `G6.1`. 타임아웃 10초.

### 3.5 Star quality — `src/lib/collectors/star-quality.ts`

GraphQL을 통해 최근 100명의 stargazer와 히스토리 중간 지점(약 50%)의 100명을 샘플링합니다. 수집 필드: `stargazerCount`, `starredAt`, 그리고 사용자별 `createdAt`, `followers`, `repositories`, `contributionsCollection.contributionCalendar.totalContributions`.

**사용자별 UQS** (User Quality Score):

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

**방출 지표:**

- `G8.1` = `totalStars × avgUqs`, 여기서 `avgUqs = (avgUqsRecent + avgUqsHistorical) / 2`.
  `rawJson`에는 `{ avgUqsRecent, avgUqsHistorical, avgUqs, burstDetected }`가 저장됩니다.
- `G8.2` = 최근 샘플의 일평균 별 수 = `recentEdges.length / rangeDays`
  (`rangeDays = (newest.starredAt − oldest.starredAt) / 86_400_000`).
- `G8.3` = **버스트 플래그** (0/1): 최근 100명 stargazer 윈도우에서 어떤 날짜 버킷이 `5 × dailyAvg`를 초과하면 설정됩니다.

---

## 4. Hugging Face 데이터 수집

소스: `src/lib/collectors/huggingface.ts`

엔드포인트 (bearer 토큰은 `HF_TOKEN`으로 선택적 사용):
1. `GET /api/models/{o}/{r}`, 404 시 `GET /api/datasets/{o}/{r}`로 fallback.
2. `GET {base}/commits?limit=100&cursor=…` (페이지네이션, 최대 10페이지).
3. `GET {base}/discussions?limit=100`.

| metricKey | Category | 파생 방식 |
|---|---|---|
| `likes` | H1 | `likes` |
| `downloads` | H1 | `downloads` (최근 윈도우) |
| `downloadsAllTime` | H1 | `downloadsAllTime` |
| `trendingScore` | H1 | `trendingScore` |
| `spaces_count` | H2 | `spaces[].length` |
| `inferenceProviderCount` | H2 | `inferenceProviderMapping`의 키 개수 |
| `inference` | H2 (메타데이터) | `inference` 문자열 |
| `library_name` | 메타데이터 | `library_name` |
| `card_score` | H4 | `cardData.description`과 `cardData.license`가 모두 있으면 1.0, 하나만 있으면 0.5, 둘 다 없으면 0 |
| `commit_count` | H3 | `period` 이후의 커밋 수 |
| `unique_contributors` | H3 | 커밋 작성자(user/name 기준) 집합의 크기 |
| `days_since_last_commit` | H3 | `floor((now − lastCommitDate)/86_400_000)` |
| `discussion_count` | H4 | 전체 discussion 수 |
| `pr_count` | H4 | `type === "pull_request"`인 항목 수 |

`likes`의 `rawJson`에 보조적인 **HF quality factor**가 저장됩니다:

```
likeDenom        = log(1 + likes·100)
hfQualityFactor  = min(1, log(1 + downloads30d) / likeDenom)
qualityLikeScore = likes · max(0.3, hfQualityFactor)
```

---

## 5. Hacker News (공용 S1)

두 플랫폼 모두에 대해 수집됩니다. `story_count`, `total_points`, `total_comments`, `engagement`(가중 관심도), 그리고 `top_story` 메타데이터 레코드를 생성하며 `scores.hnData`에 저장됩니다.

---

## 6. 지표 설정(Metric Configuration)

소스: `src/lib/scoring/config.ts`

각 지표는 다음과 같이 선언됩니다:

```ts
{
  source, key, category,
  maxI,        // 정규화에 사용되는 포화 상한
  weight,      // 카테고리 내 정수 가중치
  cumulative?, // true인 경우 recency factor 적용
  linear?,     // true면 선형 정규화; 기본값은 로그 정규화
  inverse?     // true면 정규화 전에 값을 반전 (raw가 작을수록 점수가 높음)
}
```

**튜닝 상수 — `RECENCY_FACTOR = 0.75`** (최상위 저장소가 불합리한 상한에 걸리지 않도록 `0.3`에서 커밋 `b201cb4`에서 상향됨).

### 6.1 GitHub 지표 설정

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

### 6.2 Hugging Face 지표 설정

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

### 6.3 카테고리 설정

**GitHub** (가중치 합 = 100):

| ID | Name | Weight | Metric keys |
|---|---|---:|---|
| `G-Activity` | Activity | 20 | `G2.4`, `G2.5`, `G2.2`, `G2.3_additions`, `G2.6` |
| `G-Community` | Community | 20 | `G3.1`, `G3.2`, `G3.3`, `G4.1`, `G4.2`, `G4.3`, `G4.4`, `G4.5` |
| `G-Adoption` | Adoption | 25 | `G6.1`, `G5.1`, `G5.2`, `G5.3`, `G5.4` |
| `G-Popularity` | Popularity | 15 | `stars`, `forks`, `watchers`, `G8.1`, `G8.2` |
| `G-Health` | Health | 5 | `G7.1` |
| `G-Social` | Social Buzz | 15 | `story_count`, `total_points`, `engagement` |

**Hugging Face** (가중치 합 = 100):

| ID | Name | Weight | Metric keys |
|---|---|---:|---|
| `H-Downloads` | Downloads | 25 | `downloads`, `downloadsAllTime` |
| `H-Integration` | Integration | 20 | `spaces_count`, `inferenceProviderCount` |
| `H-Activity` | Activity | 20 | `commit_count`, `unique_contributors`, `days_since_last_commit` |
| `H-Community` | Community | 10 | `discussion_count`, `pr_count`, `card_score` |
| `H-Popularity` | Popularity | 10 | `likes`, `trendingScore` |
| `H-Social` | Social Buzz | 15 | `story_count`, `total_points`, `engagement` |

---

## 7. 점수 산출 파이프라인

소스: `src/lib/scoring/` (`normalizer.ts`, `category-scores.ts`, `composite-score.ts`).

### 단계 1 — 각 지표를 `[0, 1]` 구간으로 정규화

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

- **기본값은 로그 정규화**, `maxI`에 대해 포화.
- `linear: true`는 선형 램프를 사용 — 제한된 비율 지표에 사용됩니다 (`G2.2`, `G3.3`, `G4.3`, `G2.6`, `G7.1`, `card_score`, `G5.2`).
- `inverse: true`는 스케일을 뒤집어 *작을수록 좋은* 지표로 만듭니다 (`G4.5` 머지 소요시간, `G5.2` 릴리즈 케이던스, `days_since_last_commit`).

### 단계 2 — 누적 지표에 Recency factor 적용

```ts
function applyRecencyFactor(n, cfg) {
  return cfg.cumulative ? n * RECENCY_FACTOR : n;   // 0.75
}
```

이 단계는 올타임 신호(stars, forks, dependents, all-time downloads, G7.1 health, G8.1 stargazer mass, card_score, likes, spaces_count, inferenceProviderCount)를 기간 기반(period-scoped) 활동 신호 대비 하향 조정합니다. 그 결과 현재 활발한 프로젝트가 과거 누적치에 의해 압도되지 않도록 합니다.

### 단계 3 — 카테고리 내 가중치 적용

```ts
weighted = recencyAdjusted * cfg.weight;   // cfg.weight > 0
```

### 단계 4 — Insufficiency 게이트가 포함된 카테고리 집계

```ts
// countable = 해당 카테고리에서 weight > 0 인 지표
insufficient = availableCount < countableTotal * 0.5;

categoryScore = insufficient
  ? 0
  : 100 * (Σ recencyAdjusted·weight) / (Σ weight over available metrics);
```

채점 가능한 지표의 절반 미만만 값이 산출되었다면, 해당 카테고리는 `insufficient`로 표시되어 종합 점수에서 **제외**됩니다. 이 구분이 최종 `status = "complete"`와 `status = "partial"`을 가르는 기준이기도 합니다.

### 단계 5 — 종합 점수 (0–100)

```ts
for each category in platform:
  if insufficient: push to excludedCategories; continue
  weightedSum += category.weight * category.score
  totalWeight += category.weight

compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
```

### 계산 예시 (GitHub)

카테고리별 점수가 다음과 같이 산출되었다고 가정합니다:

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

## 8. 표시 라벨(Display Labels)

소스: `src/lib/i18n/metric-labels.ts` (커밋 `868102c`).

`getMetricLabel(key, locale)`은 짧은 라벨(테이블용)을 반환하고, `getMetricDescription(key, locale)`은 호버 툴팁을 반환합니다. 영문 카피는 다음과 같습니다:

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

### Social (공용 S1)

| Key | Short | Description |
|---|---|---|
| `story_count` | HN stories | Hacker News stories mentioning the repo in the period. |
| `total_points` | HN points | Sum of points on matching stories. |
| `total_comments` | HN comments | Total comments on matching stories. |
| `engagement` | HN engagement | Weighted HN interest (points + comments). |
| `top_story` | Top HN item | Highest-point matching story (metadata). |

등록되지 않은 key에 대한 Fallback: 라벨은 `humanizeKey(key)`로 생성되며, 설명은 일반 문구인 "Metric value in the score model."이 사용됩니다.

---

## 9. 엔트리 포인트(Entry Points)

| Surface | Path | Purpose |
|---|---|---|
| HTTP | `POST /api/analyze` (`src/app/api/analyze/route.ts`) | URL 검증, `analyses` 행을 `queued` 상태로 삽입, Inngest `analysis/run` 이벤트 전송 |
| HTTP | `GET /api/status/[id]` | 진행 상황 폴링 |
| HTTP | `GET /api/report/[id]` | 최종 리포트 (`analyses` + `scores`) |
| Inngest | `analyze-repo` (이벤트 `analysis/run`, `src/inngest/functions/analyze.ts`) | 오케스트레이션된 파이프라인, 동시성 상한 적용 |

`analyses.status`를 통해 보고되는 진행 단계: `queued → collecting → scoring → complete | partial | failed`.
