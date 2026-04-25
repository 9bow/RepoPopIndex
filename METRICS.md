# RepoPopIndex 측정 명세서

이 문서는 RepoPopIndex가 GitHub 저장소와 Hugging Face 모델·데이터셋의 **인기·활동·건강성**을 어떤 신호로 어떻게 측정하는지, 그 가설은 무엇이며 어떤 한계를 가지는지, 실제 메가 OSS 프로젝트에 적용했을 때 어떤 결과가 나타나는지, 그리고 앞으로 어떤 지표를 추가로 수집할 수 있는지를 한 곳에 정리합니다.

본 문서가 답하는 질문:
1. 본 시스템은 무엇을 측정하며, 그 가설은 무엇인가
2. 어떤 데이터 소스에서 어떻게 수집하는가
3. 어떻게 정규화·가중치·집계하여 0–100 점수를 만드는가
4. 메가 OSS 프로젝트(pytorch, react, transformers, gpt2)에 적용하면 어떤 결과가 나오는가
5. 본 시스템이 측정하지 않는 것은 무엇이며, 어떤 지표를 추가할 수 있는가

본문의 모든 코드 참조는 저장소 루트 기준 상대 경로입니다.

---

## 목차

- [1. 측정 철학](#1-측정-철학)
- [2. 파이프라인 개요](#2-파이프라인-개요)
- [3. 저장 모델](#3-저장-모델)
- [4. GitHub 데이터 수집](#4-github-데이터-수집)
- [5. Hugging Face 데이터 수집](#5-hugging-face-데이터-수집)
- [6. Hacker News 사회적 화제도](#6-hacker-news-사회적-화제도)
- [7. 지표 설정 — 카탈로그](#7-지표-설정-카탈로그)
- [8. 정규화와 점수 산출](#8-정규화와-점수-산출)
- [9. 카테고리 가설과 한계](#9-카테고리-가설과-한계)
- [10. 실제 메가 OSS 측정 결과](#10-실제-메가-oss-측정-결과)
- [11. Goodhart 위험과 보호 장치](#11-goodhart-위험과-보호-장치)
- [12. 한계와 비목표](#12-한계와-비목표)
- [13. 추가 가능 지표 — 리서치 카탈로그](#13-추가-가능-지표-리서치-카탈로그)
- [14. 통합 로드맵](#14-통합-로드맵)
- [15. 출처와 참고 문헌](#15-출처와-참고-문헌)

---

## 1. 측정 철학

### 1.1 다차원 가설 (Cross-cutting Hypotheses)

- **H1. 단일 메트릭은 프로젝트 건강을 대표하지 않는다.** stars 하나로 vibrant인지 maintenance-mode인지 구분할 수 없으며, downloads 하나로 사용 사실인지 학습된 mirror 트래픽인지 구분할 수 없습니다. 따라서 본 시스템은 6–7개의 직교에 가까운 카테고리로 신호를 분리합니다.
- **H2. 카테고리 간 신호는 상관/배반 관계가 있다.** 활동성이 높아도 거버넌스가 약할 수 있고, 다운로드가 폭발해도 모델 카드는 비어 있을 수 있습니다. 종합 점수는 이러한 carrier 차이를 평균으로 평탄화하므로, *카테고리별 점수*가 종합 점수보다 실용적인 의사결정 신호입니다.
- **H3. 메가 OSS와 소형 OSS는 동일 메트릭에서 다른 분포를 가진다.** stars `maxI=200,000`은 linux/k8s 같은 톱티어가 천장에 부드럽게 닿게 캘리브레이션된 값이며, 신생 프로젝트는 G2.6 모멘텀에서 의미 있는 신호를 냅니다.
- **H4. 누적(stock) 신호와 기간(flow) 신호는 다르게 다뤄야 한다.** 별 100k는 *과거의 인기*이고, 기간 내 커밋 200건은 *현재의 활력*입니다. 본 시스템은 누적 메트릭에 `RECENCY_FACTOR = 0.75`를 곱해 stock의 weight를 절대적이지 않게 만듭니다 (`src/lib/scoring/config.ts:28`). 이전에는 0.3이었으나, 정상적인 톱티어 저장소가 Popularity 카테고리 천장 ~44/100에 갇히는 부작용으로 0.75로 상향되었습니다.

### 1.2 정규화 정책

- **로그 정규화가 기본**입니다. OSS 인기·다운로드·dependents는 멱법칙 분포이며 (Crowston et al., Mockus & Herbsleb 2002), 로그 변환이 상위와 하위의 분별력을 동시에 보존합니다.
- **선형 정규화**는 0–1 비율 메트릭(close ratio, merge ratio, owner share, community health %)이나 본래 bounded인 메트릭에 사용됩니다.
- **역방향(inverse)** 은 "작을수록 좋음" 메트릭에 적용됩니다 — 머지 소요일(G4.5), 릴리즈 케이던스(G5.2), 마지막 커밋 경과일(days_since_last_commit).

### 1.3 Insufficiency 게이트

한 카테고리의 가용 메트릭이 30% 미만이면 (`MIN_AVAILABLE_RATIO = 0.3`, `src/lib/scoring/category-scores.ts:12`), 그 카테고리는 `insufficient`로 표시되어 종합 점수에서 제외됩니다. 한 외부 API의 일시 장애가 전체 점수를 왜곡하지 않게 하는 격벽입니다. 이전에는 0.5였으나, GitHub Search secondary rate limit 한 번으로 Community 카테고리가 통째로 빠지는 사례가 잦아 0.3으로 낮췄습니다.

### 1.4 Goodhart's Law 경고

> "When a measure becomes a target, it ceases to be a good measure." — Marilyn Strathern (1997)의 Goodhart 변형.

본 시스템은 게이밍에 완전히 면역이 아닙니다. stars는 봇으로 부풀릴 수 있고, 이슈 close rate는 stale-bot으로 인위 조작 가능합니다. 본 문서의 §11은 이 위험과 시스템이 설정한 보호 장치를 구체적으로 명시합니다.

---

## 2. 파이프라인 개요

```
HTTP POST /api/analyze
   │  (Zod로 URL/플랫폼/period 검증)
   ▼
Redis Queue (zset, sliding 1h, 최대 20)
   │
   ▼
Inngest event "analysis/run"
   │  동시성 상한 = MAX_CONCURRENT_ANALYSES (기본 5)
   ▼
runAnalysis() — src/lib/orchestrator.ts
   ├─ collect (Promise.allSettled, 각 collector 15s timeout)
   │    ├─ github-graphql      (G1 메타 + G2.5)
   │    ├─ github-rest         (G2.x stats, G5.x releases, G7.x community)
   │    ├─ github-search       (G3.x issues, G4.x PRs — GraphQL alias multi-search)
   │    ├─ github-scraper      (G6.1 dependents, HTML 파싱)
   │    ├─ star-quality        (G8.x — 샘플링된 100명+50% 시점 100명 stargazer)
   │    ├─ huggingface         (H1–H4)
   │    ├─ hackernews          (S1 HN 부분)
   │    ├─ reddit              (S1 Reddit, dark-launch)
   │    ├─ stackoverflow       (S1 SO, dark-launch)
   │    └─ youtube             (S1 YouTube, dark-launch)
   │
   ├─ computeScores() — src/lib/scoring/
   │    ├─ normalize           (log / linear / inverse)
   │    ├─ apply RECENCY_FACTOR   (cumulative 메트릭에만 0.75)
   │    ├─ weight per metric
   │    ├─ aggregate per category   (insufficiency 게이트 30%)
   │    └─ aggregate categories → composite (0–100)
   │
   └─ persist → Redis
        rpi:report:{platform}:{owner}/{repo}:{period}   TTL 30d
        rpi:analysis:{id}                                TTL 30d (status/error)
        rpi:progress:{id}                                TTL 10m (live polling)
```

전체 분석 한 번의 마감은 60초 (`TOTAL_TIMEOUT`)이며, 한 collector가 timeout이나 error로 빠져도 나머지는 살아남습니다. 단, 카테고리 가용률이 30% 미만이면 그 카테고리는 종합 점수에서 제외되어 `excludedCategories`에 등록되고 `status = "partial"`로 표시됩니다.

레이트 리밋은 Upstash Redis 기반 (`src/lib/rate-limiter.ts`):

| Source | Limit |
|---|---|
| `github-rest` | 5,000 req / 3,600 s |
| `github-graphql` | 5,000 req / 3,600 s |
| `github-search` | 30 req / 60 s |
| `huggingface` | 1,000 req / 300 s |
| `hackernews` | 10,000 req / 3,600 s |

재시도 (`src/lib/retry.ts`): 최대 3회, 지수 백오프 (2s → 4s → 8s, max 30s). **403, 408, 429, 5xx**가 재시도 대상입니다. 403을 포함시킨 이유는 GitHub의 secondary rate limit이 429가 아닌 403으로 응답하기 때문입니다 (커밋 47a5d20).

`github-search`는 한 단계 위에서 collector-level 재시도(1s → 3s, 최대 3회)를 추가로 수행합니다. GraphQL이 HTTP 200으로 응답하면서 일부 alias만 errors 배열에 들어가는 partial 응답을 감지해 재시도하며, 끝까지 실패하면 부분 데이터 대신 명시적 null + error를 반환합니다 — 한 alias 실패로 Community 점수가 무너지지 않게 하는 방어선입니다.

---

## 3. 저장 모델

본 시스템은 **PostgreSQL을 사용하지 않습니다.** 모든 영속 상태는 Upstash Redis에 저장되며 TTL로 자연 만료됩니다.

| 키 패턴 | 용도 | TTL |
|---|---|---|
| `rpi:report:{platform}:{owner}/{repo}:{period}` | 완료된 분석 리포트 (최종 산출물) | 30일 |
| `rpi:analysis:{id}` | 진행 중 분석의 메타 (status/error/completedAt) | 30일 |
| `rpi:progress:{id}` | 진행률 폴링용 라이브 업데이트 | 10분 |
| `rpi:queue` | 분석 큐 (sorted set, 최대 20) | 1시간 sliding |
| `rpi:rate:{source}` | 소스별 레이트 리미터 카운터 | window별 |
| `rpi:social:metrics:{analysisId}` | dark-launch 소셜 메트릭 blob | 30일 |

리포트 객체에 저장되는 주요 필드:

| 필드 | 의미 |
|---|---|
| `compositeScore` | 0–100 종합 점수 |
| `categoryScores` | `Record<categoryId, { name, score, maxScore:100, metrics, insufficient, reason? }>` |
| `metricScores` | `Record<metricKey, { raw, normalized, weighted }>` |
| `excludedCategories` | 데이터 부족으로 제외된 카테고리 ID 배열 |
| `starQualityFactor`, `starQualityRecent`, `starQualityHistorical`, `starBurstDetected` | G8에서 비정규화된 빠른 조회용 필드 |
| `hnData` | `{ storyCount, totalPoints, totalComments, topStory, engagement }` |

DB를 두지 않은 이유: 모든 PG 쿼리가 `where id = ?` 단건 룩업이었고 raw_metrics는 작성 후 한 번도 읽히지 않았습니다. 영속성이 필요한 유일한 데이터는 "완료된 리포트"이며, 이는 결정적 캐시 키로 자연스럽게 dedup되어 30일 TTL Redis로 충분합니다 (커밋 abcc711).

---

## 4. GitHub 데이터 수집

### 4.1 `github-graphql` — Fundamentals + 기간 활동 카운트

엔드포인트: `POST https://api.github.com/graphql` — `repository(owner, name)` 단일 쿼리에 stargazerCount, forkCount, watchers, defaultBranchRef.target.history(since), issues/pullRequests/discussions의 totalCount, licenseInfo.spdxId, primaryLanguage 포함. `hasDiscussionsEnabled = false`인 저장소에서는 폴백 쿼리 `QUERY_NO_DISCUSSIONS`로 자동 재시도합니다.

| metricKey | Category | 의미 | 출처 필드 |
|---|---|---|---|
| `stars` | G1/Popularity | 전체 별 수 | `stargazerCount` |
| `forks` | G1/Popularity | 전체 포크 수 | `forkCount` |
| `watchers` | G1/Popularity | watcher 수 | `watchers.totalCount` |
| `G2.5` | G2/Activity | 기간 내 커밋 수 | `defaultBranchRef.target.history(since).totalCount` |
| (메타) | — | 라이선스, 주 언어, 생성·푸시 시각 | `licenseInfo.spdxId`, `primaryLanguage`, `createdAt`, `pushedAt` |

또한 메타데이터(채점 미사용): `description`, `hasIssuesEnabled`, `hasDiscussionsEnabled`, `open_issues`, `open_prs`, `discussions_count`.

### 4.2 `github-search` — Issue/PR 동작 (단일 GraphQL 다중 alias)

엔드포인트: GraphQL search. 4개의 search query를 alias로 묶어 한 번에 호출합니다. REST `/search/issues`는 동시 분석 시 secondary rate limit(403)으로 재시도가 자주 실패해 Community 카테고리 전체가 N/A로 무너지는 문제가 있어 GraphQL alias로 통합되었습니다 (커밋 ddc70de). partial-error 재시도가 추가로 적용되어 한 alias 실패로 카테고리가 무너지는 케이스를 차단합니다.

| metricKey | Category | 정의 |
|---|---|---|
| `G3.1` | G3/Community | 기간 내 신규 이슈 수 (`type:issue created:>{since}`) |
| `G3.2` | G3 | 기간 내 종료 이슈 수 (`type:issue closed:>{since}`) |
| `G3.3` | G3 | 이슈 종료율 = `G3.2 / G3.1` (linear, 0–1) |
| `G4.1` | G4/Community | 기간 내 신규 PR 수 (`type:pr created:>{since}`) |
| `G4.2` | G4 | 기간 내 머지 PR 수 (`type:pr merged:>{since}`) |
| `G4.3` | G4 | PR 머지율 = `G4.2 / G4.1` (linear, 0–1) |
| `G4.4` | G4 | 머지 PR 30개 샘플의 **고유 작성자 수** (외부 기여자 다양성) |
| `G4.5` | G4 | 머지 PR의 **중앙값 머지 소요일** (낮을수록 좋음, `inverse`) |

### 4.3 `github-rest` — 활동 통계 + 릴리즈 + 커뮤니티 프로파일

엔드포인트 6개 병렬:

| metricKey | Category | 정의 | 엔드포인트 |
|---|---|---|---|
| `G2.4` | G2/Activity | 누적 기여자 수 (Link 헤더 last page) | `/contributors?per_page=1&anon=true` |
| `G2.1` | G2 | 52주 총 커밋 수 (참고용, 가중치 0) | `/stats/participation` |
| `G2.2` | G2 | 외부 기여자 비율 = `1 − owner/all` (linear, 0–1) | `/stats/participation` |
| `G2.3_additions` | G2 | 기간 내 코드 추가 라인 수 | `/stats/code_frequency` |
| `G2.6` | G2 | 활동 모멘텀 = `최근 4주 합 / 직전 4주 합` (>1이면 가속) | `/stats/participation` |
| `G5.1` | G5/Adoption | 기간 내 릴리즈 수 | `/releases?per_page=100` |
| `G5.2` | G5 | 릴리즈 평균 간격(일, `inverse`) | `/releases` |
| `G5.3` | G5 | 기간 내 릴리즈 다운로드 합 | `/releases` |
| `G5.4` | G5 | 누적 태그 수 (참고용, 가중치 0) | `/tags` |
| `G7.1` | G7/Health | GitHub Community Health Score (0–100) | `/community/profile` |
| `G7.2`/`G7.3`/`G7.4` | G7 | CONTRIBUTING/CoC/README 존재 여부 | `/community/profile` |

`/stats/*` 엔드포인트는 서버측 캐시 미준비 시 **HTTP 202**를 반환하므로 retry 정책에 202가 재시도 대상으로 포함되어 있습니다.

### 4.4 `github-scraper` — Dependent 저장소 수

소스: `https://github.com/{owner}/{repo}/network/dependents` HTML 파싱. 공식 API가 미제공이므로 Cheerio + 정규식 `(\d[\d,]*)\s*Repositories`로 추출합니다. 타임아웃 10초, `maxI = 5,000,000` (npm-규모 생태계의 express ~60M 같은 케이스를 고려).

| metricKey | Category | 정의 |
|---|---|---|
| `G6.1` | G6/Adoption | "Used by N Repositories" 숫자 |

### 4.5 `star-quality` — 별 품질 보정 (G8)

봇·이벤트 폭주를 보정하기 위해 **최근 100명의 stargazer**와 **히스토리 중간 시점의 100명**을 GraphQL로 샘플링해 사용자 품질 점수(UQS)를 계산합니다.

```ts
ageDays = (now − user.createdAt) / 86_400_000
bot = ageDays < 7 OR (followers == 0 AND repositories == 0 AND contributions == 0)
if bot: UQS = 0
else:
  A = min(1, ageDays         / 730)         // 계정 나이 (2년 만점)
  F = min(1, log(1+followers) / log(1+100))  // 팔로워
  R = min(1, log(1+repos)     / log(1+30))   // 보유 저장소
  C = min(1, log(1+contribs)  / log(1+500))  // contribution
  UQS = 0.25·A + 0.25·F + 0.25·R + 0.25·C
```

| metricKey | Category | 정의 |
|---|---|---|
| `G8.1` | G8/Popularity | **Quality Star Score** = `totalStars × avgUqs` (`avgUqs = (recent + historical) / 2`) |
| `G8.2` | G8 | 최근 별 도착률 (개/일) |
| `G8.3` | G8 | 별 폭주 플래그 (0/1, 일별 카운트 중 `> 평균 × 5`가 있으면 1) |

`rawJson`에 `{ avgUqsRecent, avgUqsHistorical, avgUqs, burstDetected }`가 함께 저장되어 리포트 UI의 "Star quality assessment" 카드에 표시됩니다.

---

## 5. Hugging Face 데이터 수집

엔드포인트: `https://huggingface.co/api/{models|datasets}/{owner}/{repo}` (모델 → 404면 dataset로 폴백). `HF_TOKEN`은 선택적이며, 없어도 공개 메타는 호출됩니다.

호출 구성:
1. `GET /api/models/{o}/{r}` (또는 datasets fallback)
2. `GET {base}/commits?limit=100&cursor=…` (페이지네이션, 최대 10페이지)
3. `GET {base}/discussions?limit=100`

| metricKey | Category | 정의 | 정규화 maxI |
|---|---|---|---|
| `likes` | H1/Popularity | 좋아요 수 (cumulative) | 5,000 (log) |
| `downloads` | H1/Downloads | 최근 30일 다운로드 | 10,000,000 (log) |
| `downloadsAllTime` | H1/Downloads | 누적 다운로드 (cumulative) | 100,000,000 (log) |
| `trendingScore` | H1/Popularity | HF 트렌딩 점수 | 100 (log) |
| `spaces_count` | H2/Integration | 모델을 사용하는 Spaces 수 (cumulative) | 100 (log) |
| `inferenceProviderCount` | H2 | Inference provider 매핑 수 (cumulative) | 10 (log) |
| `commit_count` | H3/Activity | 기간 내 커밋 수 | 500 (log) |
| `unique_contributors` | H3 | 커밋 작성자 고유 수 | 50 (log) |
| `days_since_last_commit` | H3 | 마지막 커밋부터 경과 일 (`inverse`) | 365 (log) |
| `discussion_count` | H4/Community | discussions API 총 수 | 100 (log) |
| `pr_count` | H4 | discussions 중 `type=pull_request` | 50 (log) |
| `card_score` | H4 | description+license 둘 다=1.0, 하나만=0.5, 없음=0 | 1.0 (linear, cumulative) |

좋아요 신호도 다운로드/좋아요 비율 기반의 `hfQualityFactor`로 보정합니다 (`rawJson`에 저장):

```
likeDenom        = log(1 + likes·100)
hfQualityFactor  = min(1, log(1 + downloads30d) / likeDenom)
qualityLikeScore = likes · max(0.3, hfQualityFactor)
```

---

## 6. Hacker News 사회적 화제도

엔드포인트: `https://hn.algolia.com/api/v1/search?query=...&tags=story&numericFilters=created_at_i>{since}`. 쿼리는 `github.com/{owner}/{repo}` 또는 `huggingface.co/{owner}/{repo}`로 자동 구성됩니다. GitHub과 HF 양 플랫폼 모두에 적용되는 공용 S1 카테고리입니다.

| metricKey | Category | 정의 |
|---|---|---|
| `story_count` | S1/Social Buzz | 기간 내 등록된 스토리 수 |
| `total_points` | S1 | 스토리 포인트 합계 |
| `total_comments` | S1 | 댓글 합계 (참고용) |
| `engagement` | S1 | `points × 1.0 + comments × 1.5` (composite) |
| `top_story` | S1 | 가장 높은 점수의 스토리 (제목/URL/포인트) — 리포트 UI 카드 |

### Reddit / Stack Overflow / YouTube (dark-launch)

자격 정보가 있을 때만 동작하며, 현재는 종합 점수에 영향을 주지 않고 별도 Redis blob(`rpi:social:metrics:{analysisId}`)에 저장만 됩니다. config.ts에는 가중치가 매겨져 있지만 실제 collector가 제공하는 데이터는 카테고리 가중치 합 8/5/4/3 (HN/Reddit/SO/YouTube ≈ 40/25/20/15%) 분배에 따라 단계적으로 활성화될 예정입니다.

---

## 7. 지표 설정 — 카탈로그

소스: `src/lib/scoring/config.ts`. 각 지표는 다음 형태로 선언됩니다:

```ts
{
  key, category,
  maxI,        // 정규화 포화 상한
  weight,      // 카테고리 내 정수 가중치
  cumulative?, // true면 RECENCY_FACTOR 적용
  linear?,     // true면 선형 정규화 (기본은 로그)
  inverse?     // true면 정규화 전에 값을 반전
}
```

튜닝 상수: `RECENCY_FACTOR = 0.75` (`config.ts:28`), `MIN_AVAILABLE_RATIO = 0.3` (`category-scores.ts:12`).

### 7.1 GitHub 지표 설정

| Key | Category | maxI | Weight | cumul | linear | inverse |
|---|---|---:|---:|:-:|:-:|:-:|
| `stars` | G1 | 200,000 | 3 | ✓ | | |
| `forks` | G1 | 50,000 | 1 | ✓ | | |
| `watchers` | G1 | 10,000 | 1 | ✓ | | |
| `G2.4` contributors | G2 | 500 | 3 | | | |
| `G2.5` graphql commits | G2 | 2,000 | 2 | | | |
| `G2.2` external share | G2 | 1.0 | 2 | | ✓ | |
| `G2.3_additions` | G2 | 50,000 | 1 | | | |
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
| `G5.3` release DLs | G5 | 1,000,000 | 2 | | | |
| `G5.4` tags | G5 | 200 | 0 | | | |
| `G6.1` dependents | G6 | 5,000,000 | 3 | ✓ | | |
| `G7.1` community health | G7 | 100 | 1 | ✓ | ✓ | |
| `G8.1` star quality mass | G8 | 200,000 | 3 | ✓ | | |
| `G8.2` arrival rate | G8 | 100 | 2 | | | |

### 7.2 Hugging Face 지표 설정

| Key | Category | maxI | Weight | cumul | linear | inverse |
|---|---|---:|---:|:-:|:-:|:-:|
| `likes` | H1 | 5,000 | 2 | ✓ | | |
| `downloads` | H1 | 10,000,000 | 3 | | | |
| `downloadsAllTime` | H1 | 100,000,000 | 2 | ✓ | | |
| `trendingScore` | H1 | 100 | 1 | | | |
| `spaces_count` | H2 | 100 | 2 | ✓ | | |
| `inferenceProviderCount` | H2 | 10 | 1 | ✓ | | |
| `commit_count` | H3 | 500 | 2 | | | |
| `unique_contributors` | H3 | 50 | 2 | | | |
| `days_since_last_commit` | H3 | 365 | 1 | | | ✓ |
| `discussion_count` | H4 | 100 | 1 | | | |
| `pr_count` | H4 | 50 | 1 | | | |
| `card_score` | H4 | 1.0 | 1 | ✓ | ✓ | |

### 7.3 카테고리 가중치

**GitHub** (가중치 합 = 100):

| ID | Name | Weight | Metric keys |
|---|---|---:|---|
| `G-Adoption` | Adoption | 25 | `G6.1`, `G5.1–G5.4` |
| `G-Activity` | Activity | 20 | `G2.4`, `G2.5`, `G2.2`, `G2.3_additions`, `G2.6` |
| `G-Community` | Community | 20 | `G3.1`, `G3.2`, `G3.3`, `G4.1–G4.5` |
| `G-Popularity` | Popularity | 15 | `stars`, `forks`, `watchers`, `G8.1`, `G8.2` |
| `G-Social` | Social Buzz | 15 | `story_count`, `total_points`, `engagement` (+ Reddit/SO/YouTube dark-launch) |
| `G-Health` | Health | 5 | `G7.1` |

**Hugging Face** (가중치 합 = 100):

| ID | Name | Weight | Metric keys |
|---|---|---:|---|
| `H-Downloads` | Downloads | 25 | `downloads`, `downloadsAllTime` |
| `H-Activity` | Activity | 20 | `commit_count`, `unique_contributors`, `days_since_last_commit` |
| `H-Integration` | Integration | 20 | `spaces_count`, `inferenceProviderCount` |
| `H-Social` | Social Buzz | 15 | HN + dark-launch |
| `H-Community` | Community | 10 | `discussion_count`, `pr_count`, `card_score` |
| `H-Popularity` | Popularity | 10 | `likes`, `trendingScore` |

### 7.4 가중치 설계의 의도

- **GitHub: Adoption=25 > Activity=Community=20 > Popularity=Social=15 > Health=5**
  외부 사용(dependents, releases)은 내부 활동·커뮤니티보다 강한 가치 신호이고, 인기·HN 화제는 lagging이며 게이밍이 쉬워 한 단계 낮습니다. Health는 메가 OSS에서 거의 100점에 수렴해 식별력이 낮으므로 의도적으로 5에 둡니다.
- **HF: Downloads=25 > Activity=Integration=20 > Social=15 > Community=Popularity=10**
  좋아요는 사용 의향, 다운로드는 사용 사실. HF에서는 모델 카드 품질·discussion이 거버넌스 성숙의 1차 신호이지만 메가 모델일수록 PR/discussion이 적어(huggingface 본사 일괄 관리) Community 가중을 GitHub보다 낮게 잡았습니다.

---

## 8. 정규화와 점수 산출

소스: `src/lib/scoring/{normalizer.ts,category-scores.ts,composite-score.ts}`.

### 단계 1 — 각 지표를 `[0, 1]`로 정규화

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

- 기본값 = 로그 정규화 (멱법칙 분포에 적합).
- `linear: true` = 비율·bounded 메트릭에 사용 (`G2.2`, `G3.3`, `G4.3`, `G2.6`, `G7.1`, `card_score`, `G5.2`).
- `inverse: true` = "작을수록 좋음" 메트릭 (`G4.5` 머지 소요시간, `G5.2` 릴리즈 케이던스, `days_since_last_commit`).

### 단계 2 — 누적 메트릭에 Recency Factor 적용

```ts
function applyRecencyFactor(n, cfg) {
  return cfg.cumulative ? n * RECENCY_FACTOR : n;   // 0.75
}
```

stars/forks/dependents/all-time downloads/G7.1/G8.1/likes/spaces_count/inferenceProviderCount/card_score 같은 stock 신호는 0.75로 하향 조정됩니다. 이전에는 0.3이었으나, 톱티어 OSS의 Popularity가 ~44/100에 갇히는 부작용으로 0.75로 상향되었습니다 (커밋 b201cb4).

### 단계 3 — 카테고리 점수 산출 (insufficiency 게이트 포함)

```ts
// countable = 카테고리 내 weight > 0 인 지표들
insufficient = availableCount < countableTotal * 0.3;

availableCeiling = Σ metricCeiling(cfg) · cfg.weight   // = recencyFactor (cumul) or 1
categoryScore = insufficient
  ? 0
  : 100 · (Σ recencyAdjusted·weight) / availableCeiling
```

`availableCeiling`로 재스케일하는 이유: `cumulative: true` 메트릭만으로 이루어진 카테고리도 100점에 도달할 수 있게 하기 위함입니다. RECENCY_FACTOR=0.75가 곱해진 메트릭만 5개라도, 데이터가 모두 있다면 100/100을 받을 수 있어야 의미 있는 점수가 됩니다.

### 단계 4 — 종합 점수 (0–100)

```ts
for each category:
  if insufficient: excludedCategories.push(cat.id); continue
  weightedSum += cat.weight · cat.score
  totalWeight += cat.weight

compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0
```

### 8.1 계산 예시 (가설값)

| Category | Score | Weight |
|---|---:|---:|
| Activity | 80 | 20 |
| Community | 60 | 20 |
| Adoption | 50 | 25 |
| Popularity | 90 | 15 |
| Health | 70 | 5 |
| Social | 40 | 15 |

```
weightedSum    = 20·80 + 20·60 + 25·50 + 15·90 + 5·70 + 15·40 = 6,350
totalWeight    = 100
compositeScore = 6,350 / 100 = 63.5
```

---

## 9. 카테고리 가설과 한계

각 카테고리가 답하려는 질문, 어떤 가설로 메트릭을 선정했는지, 무엇을 놓치는지를 한 묶음으로 정리합니다.

### 9.1 GitHub Popularity (G1, G8)

- **가설:** "별·포크·watcher는 *발견(discovery)*과 *기억할 만한 인상(memorable impression)*의 lagging indicator." 별은 "북마크" 행동에 가깝고 (Borges & Valente 2018), 사용 사실보다는 인지도를 측정합니다.
- **메트릭:** `stars`, `forks`, `watchers` (G1, 모두 cumulative log) / `G8.1` Quality Star Score (`stars × avgUqs`), `G8.2` 별 도착률.
- **한계:** stars만으로는 frozen mirror 저장소와 vibrant project를 구분 못합니다. G2(Activity)와의 조합이 필수이며, G8 UQS 보정으로 봇 스타 부풀리기를 일정 부분 완화합니다.
- **Goodhart 위험:** "buy stars" 봇 농장 → G8 UQS로 0에 가까워짐. 여전히 G1만 보면 부풀려지므로 카테고리 점수가 아니라 *카테고리 + Star quality assessment 카드*를 함께 봐야 합니다.

### 9.2 GitHub Activity (G2)

- **가설:** "커밋 수 + 외부 기여자 비율 + 최근 4주/직전 4주 모멘텀 = 코드베이스가 *살아있음*과 *집단지능*임을 동시에 검증한다." 단순 커밋 수만으로는 한 명의 솔로 메인테이너가 미친듯이 push하는 케이스도 만점이 가능하므로, G2.2(외부 기여 비율)와 G4.4(PR 작성자 다양성)로 *분산*도 함께 측정합니다.
- **메트릭:** `G2.4` 누적 기여자, `G2.5` GraphQL 기간 커밋, `G2.2` 외부 기여 비율, `G2.3_additions` 추가 라인, `G2.6` 모멘텀.
- **한계:** dependabot/renovate 같은 봇 커밋은 별도 필터링되지 않아 활동성을 부풀릴 수 있습니다. squash-merge로 인한 기여자 inflation도 보정되지 않습니다.
- **Goodhart 위험:** "활동성을 올리려면 커밋을 잘게 쪼개라" — G2.3_additions 라인 수 변화가 동반되어야 하므로 부분적 방어. 하지만 G2.5는 여전히 게이밍 가능.

### 9.3 GitHub Community (G3, G4)

- **가설:** "이슈 종료율 + PR 머지 소요시간 + PR 작성자 다양성 = 메인테이너 응답성과 외부 기여 흡수율의 정량 proxy." Kalliamvakou et al. 2014 ("The promises and perils of mining GitHub")의 경고를 반영해, "이슈 종료" 자체보다 *비율*과 *수*를 동시에 봅니다.
- **메트릭:** `G3.1`–`G3.3`(이슈), `G4.1`–`G4.5`(PR).
- **한계:** stale-bot이 자동 close하는 케이스, "wontfix" 일괄 close 등은 정량으로 구분되지 않습니다. close ratio가 1을 넘는 케이스(react 1.121, transformers 1.007)는 *기간 외에 열린 이슈가 기간 내에 닫힌* 결과이며 정상 신호이지만, 1.0에서 cap된 정규화로 인해 추가 정보를 잃습니다.
- **Goodhart 위험:** "stale-bot으로 1주마다 일괄 close" → G3.3은 만점이지만 G3.1과 G3.2가 동시에 낮아짐 (실질 활동 부재). G4.4(PR 작성자 다양성)는 외부 기여를 직접 측정해 이 게이밍과 직교합니다.

### 9.4 GitHub Adoption (G5, G6)

- **가설:** "릴리즈 케이던스 + 의존 저장소 수 = 공급망에서의 *중력(gravity)*. 누가 이 프로젝트를 실제로 *사용*하는가." Decan et al. 2019 ("Dependency network evolution")의 dependency centrality 개념을 단순화한 형태입니다.
- **메트릭:** `G5.1`(기간 릴리즈 수), `G5.2`(케이던스, inverse), `G5.3`(다운로드 합), `G6.1`(dependents).
- **한계:** dependents는 GitHub의 best-effort 표시(network/dependents 페이지)로, 실제 npm/pypi 다운로드와 자릿수가 일치하지 않을 수 있습니다 (transformers의 dependents 409,103 vs npm/pip 다운로드는 자릿수가 더 큼). Release downloads(G5.3)는 GitHub Releases asset에 한정되어, 패키지 매니저로만 배포되는 라이브러리는 0이 나옵니다 (react: 0).
- **Goodhart 위험:** "fork inflation" → G6.1은 dependent *저장소* 수이고 fork는 dependent로 카운트되지 않으므로 직접 게이밍은 어렵지만, "vendoring" 패턴(서브트리 복사)은 dependents에서 빠져 underestimate 가능.

### 9.5 GitHub Health (G7)

- **가설:** "CONTRIBUTING/CoC/README 존재 = *외부 기여자가 진입할 수 있는 표면적*의 1차 근사." Coelho & Valente 2017 ("Why modern open source projects fail").
- **메트릭:** `G7.1` (GitHub Community Health Score 0–100, 본 시스템에서 그대로 사용).
- **한계:** 문서 *존재*만 확인하며 품질은 미확인. 메가 OSS는 거의 100점이라 식별력이 낮습니다 — 그래서 가중치 5.
- **Goodhart 위험:** "체크박스 채우기 위한 빈 CONTRIBUTING.md" → 점수만점, 실제 진입 가능성은 미상. 가중치 5로 의도적으로 영향력을 제한.

### 9.6 GitHub Social Buzz (S1)

- **가설:** "HN 노출 + Reddit/SO/YouTube 언급 = 코드 리포 내부 신호와 *독립한* 외부 검증." 인프라 라이브러리는 HN 점수가 낮아도 dependents가 압도적인 경우가 있어 (Adoption과의 *해리*) 카테고리 분리가 가치를 가집니다.
- **메트릭:** `story_count`, `total_points`, `engagement`(HN), + Reddit/SO/YouTube dark-launch.
- **한계:** HN 검색은 URL 매칭 기반이므로 별칭 리포지토리·rewrite된 URL은 누락. 기간 외 인기 글은 자동으로 빠집니다.
- **Goodhart 위험:** "HN에 자기 글 올리고 친구들이 upvote" → HN 알고리즘 자체의 anti-gaming(early flag, voting ring detection)이 1차 방어. burstDetected 플래그는 별 폭증에만 적용되고 HN에는 없으므로, HN 점수는 단독으로 보지 말고 카테고리 점수 + top_story 카드로 검증합니다.

### 9.7 Hugging Face Downloads (H1)

- **가설:** "다운로드는 *사용 의향*이 아닌 *사용 사실*. 모델은 다운로드 직후 추론에 투입되므로, downloads는 GitHub stars보다 사용에 가깝다."
- **메트릭:** `downloads` (최근 30일), `downloadsAllTime` (cumulative).
- **한계:** mirror/proxy 트래픽, 자동화된 학습/평가 파이프라인의 다운로드가 구분되지 않습니다. 30일 윈도우는 HF가 제공하는 단일 값이라 sub-period 분해는 불가.
- **Goodhart 위험:** "다운로드 봇팜" → HF는 IP·UA 기반 디덕션을 일부 적용하지만 공개되지 않음. trendingScore와의 cross-check가 1차 방어.

### 9.8 Hugging Face Integration (H2)

- **가설:** "Spaces 수 + Inference provider 수 = 모델이 *재가공되어 다른 도구에 흡수*되었는가." 베이스 모델 vs 파인튜닝 모델을 카테고리 차원에서 자연 구분합니다.
- **메트릭:** `spaces_count`, `inferenceProviderCount` (모두 cumulative).
- **한계:** Spaces가 활성/비활성 상태를 구분하지 않습니다. 죽은 Space도 카운트됩니다.
- **Goodhart 위험:** "공허한 Space 100개 만들기" → 가능. HF의 Space 활성도 시그널이 없어 직접 보호 장치 없음.

### 9.9 Hugging Face Activity (H3)

- **가설:** "기간 커밋 수 + 고유 기여자 + 마지막 커밋 경과일 = 모델이 *유지보수 중*인지 *frozen*인지 구분."
- **메트릭:** `commit_count`, `unique_contributors`, `days_since_last_commit` (inverse).
- **한계:** HF는 GitHub만큼 PR 흐름이 활발하지 않아, 메가 모델의 Activity가 0에 가까운 케이스가 정상입니다 (gpt2 Activity 0/100 — §10 참고).
- **Goodhart 위험:** "weight 안 바꾸고 README만 수정해서 커밋 횟수 부풀리기" → 가능. card 변경과 weight 변경 구분 신호 없음.

### 9.10 Hugging Face Community / Popularity / Social (H4, H1, S1)

- **Community:** discussions + PR + card_score. card_score는 description+license 둘 다=1, 하나만=0.5, 없음=0의 거친 룹브릭이며 §13.5에서 13항목 룹브릭 확장 권고.
- **Popularity:** likes + trendingScore. likes는 hfQualityFactor로 다운로드/좋아요 비율 보정.
- **Social:** GitHub과 공통.

---

## 10. 실제 메가 OSS 측정 결과

본 절은 `https://repopopindex.vercel.app`에서 실제 측정한 4개 메가 OSS 결과입니다 (분석 시각: 2026-04-25). 시간이 지나면 값이 달라지므로 *작성 시점 스냅샷*임을 명시합니다.

### 10.1 pytorch/pytorch — GitHub, 3 months

**Composite: 77/100 (Active)**

| Category | Score | 핵심 metric raw |
|---|---:|---|
| Popularity | 92 | stars 99,424; forks 27,588; watchers 1,771 |
| Activity | 85 | contributors 6,444; GraphQL commits 4,519; ext share 1.0 |
| Health | 87 | Community Health % 87 |
| Social Buzz | 72 | HN stories 20; HN points 239; engagement 306.5 |
| Adoption | 62 | releases 1; release downloads 1,648; tags 3,465 |
| Community | **Insufficient** | (게이트 제외, GitHub Search secondary rate limit 추정) |

- **관찰 1 — Community insufficient.** 3개월 윈도우에서 Community 가용 메트릭이 30% 미만으로 떨어져 카테고리가 통째로 제외됨. github-search secondary rate limit(403)의 실제 발생 사례. 이 사건은 본 시스템이 §1.3에서 0.5 → 0.3으로 게이트를 낮춘 *바로 그 시나리오*입니다.
- **관찰 2 — Popularity 92이지만 Star Quality 0%.** "Quality factor 0%, Recent UQS 0" — 최근 100명 stargazer 샘플의 UQS 평균이 0에 수렴. 봇/저품질 계정 비율이 매우 높거나, 샘플 윈도우가 burst 직후라 신생 계정이 몰린 가능성. composite 77이 진짜 인기인지 burst 잔존인지는 G8.3(burstDetected)와 함께 봐야 함.
- **관찰 3 — Top HN story:** "Show HN: Run TRELLIS.2 Image-to-3D generation natively on Apple Silicon (202 pts)". 흥미롭게도 이는 *pytorch 자체*가 아닌 *pytorch를 사용한 3rd-party*가 HN에 올린 글로, HN URL 매칭의 한계(§9.6)를 잘 보여줍니다.
- **시사점:** Composite 77은 평이해 보이지만, Community insufficient + Star Quality 0 둘을 제거하면 *실질 활성 카테고리 4개의 평균*은 더 높음. 단일 점수로 의사결정하면 안 되는 전형적 케이스.

### 10.2 facebook/react — GitHub, 3 months

**Composite: 69/100 (Active)**

| Category | Score | 핵심 metric raw |
|---|---:|---|
| Health | 100 | Community Health % 100 |
| Popularity | 93 | forks 50,979; G8.1 stargazer mass 135,127.556; G8.2 33.355 |
| Community | 83 | issues opened 140; closed 157; close rate 1.121 |
| Activity | 77 | contributors 1,981; GraphQL commits 171; ext share 1.0 |
| Adoption | 59 | releases 8; cadence 11.586d; release downloads 0 |
| Social Buzz | 22 | HN stories 1; HN points 5 |

- **관찰 1 — Health 100, Star Quality 55%.** §1.4 Goodhart 경고의 깔끔한 사례. 메가 OSS는 거의 자동으로 Health 100을 받으므로(가중치 5의 정당화), Star Quality 55%가 더 분별력 있는 신호. UQS가 절반 정도라는 것은 *bot 대비 진짜 사용자가 압도적이지는 않다*는 의미.
- **관찰 2 — Adoption 59 with release downloads 0.** react는 npm으로만 배포되므로 GitHub Releases asset 다운로드가 0. G5.3은 release-binary 다운로드(예: kubernetes binaries)에 강하고, npm/pypi-only 라이브러리에는 약합니다. §13.6에서 libraries.io API 통합으로 보강 권고.
- **관찰 3 — Social Buzz 22 vs Adoption 59.** HN에서 react 자체가 거의 화제되지 않는 *인프라화* 단계. §9.6의 "Adoption과 Social Buzz의 해리"가 정확히 관찰됨 — 인프라 라이브러리는 더 이상 새 소식거리가 아니지만, 사용 기반은 광활.
- **관찰 4 — close rate 1.121 (>1).** §9.3에서 언급한 정상 신호. 기간 외 열린 이슈가 기간 내 닫혀 발생하며, 1.0에서 cap되어 G3.3 점수에 추가 정보가 반영되지 않음.
- **GraphQL commits 171 vs contributors 1,981.** 누적 1,981명의 기여자 풀에서 3개월 동안 적극 활동한 인원이 그 일부. G2.2 외부 기여자 비율 1.0과 결합해 보면 "오너 외 기여자가 거의 모두" — 잘 distributed된 메가 OSS의 전형.

### 10.3 huggingface/transformers — GitHub, 3 months

**Composite: 71/100 (Active)** [partial — reddit collector 누락]

| Category | Score | 핵심 metric raw |
|---|---:|---|
| Health | 100 | Community Health % 100 |
| Popularity | 92 | stars 159,893; forks 33,005; watchers 1,195 |
| Community | 87 | issues opened 434; closed 437; close rate 1.007 |
| Activity | 81 | contributors 3,899; GraphQL commits 944; ext share 1.0 |
| Adoption | 56 | dependents 409,103; releases 14; cadence 6.72d |
| Social Buzz | 27 | HN stories 9; HN points 31; engagement 38.5 |

- **관찰 1 — Stars 159,893 (가장 높음) but Composite 71 (pytorch 77, react 69보다 중간).** §H1을 검증하는 사례 — "단일 메트릭은 프로젝트 건강을 대표하지 않는다." stars 1위지만 종합 점수는 중간이며, 이는 Adoption 56(release-asset 다운로드 부재로 G5.3 ≈ 0)과 Social Buzz 27이 끌어내림.
- **관찰 2 — Adoption 56이지만 Dependents 409,103.** dependents 자릿수만 보면 react보다 많은 의존이 걸려있음 (react는 npm으로만 분포되어 GitHub dependents에 카운트되지 않음). Adoption 카테고리 점수가 dependents 자릿수만큼 가파르게 오르지 않는 이유는 G5.3 release downloads가 약하기 때문.
- **관찰 3 — Release cadence 6.72일.** 6일에 한 번 릴리즈 — 매우 빠른 케이던스. G5.2는 inverse(짧을수록 좋음)이므로 강한 신호. Adoption 56이 cadence 단독으로 끌어올려질 수도 있는데 dependents의 log 정규화 효과로 점수가 평탄.
- **관찰 4 — Top HN: "Transformers V5 is out! (10 pts)".** 의외로 낮은 점수. 메가 인프라가 인프라화될수록 신상품이 아닌 다음에야 HN에서 큰 화제가 안 되는 패턴.
- **partial:reddit:** Reddit collector가 자격 정보 미설정 또는 일시 오류로 빠짐. 카테고리는 살아남고 Reddit-specific 메트릭만 누락된 상태로 종합 점수가 산출됨 (§9.6 dark-launch 정책).

### 10.4 openai-community/gpt2 — Hugging Face, 1 month

**Composite: 53/100 (Moderate)** [partial — reddit 누락]

| Category | Score | 핵심 metric raw |
|---|---:|---|
| Downloads | 100 | recent downloads 14,554,759 |
| Popularity | 95 | likes 3,219 |
| Integration | 67 | HF Spaces 100; inference providers 0 |
| Community | 50 | discussions 146; HF PRs 0; card quality 0.5 |
| **Activity** | **0** | HF commits 0; HF contributors 0 |
| Social Buzz | 0 | HN stories 0 |

- **관찰 1 — Downloads 100 + Activity 0.** "Frozen but heavily used" 패턴의 교과서 사례. gpt2는 6년이 넘은 모델이지만 1개월 동안 1,455만 회 다운로드. weight 변경이 없는 모델은 새 커밋이 발생하지 않으며, 본 시스템의 H3 Activity 카테고리가 0/100을 정확히 반영합니다.
- **관찰 2 — Composite 53 (Moderate).** 한쪽에 100, 다른 쪽에 0인 양극 분포가 평균으로 평탄화되는 §H2의 예시. 종합 점수만 보면 "moderate"지만 실제로는 *영원히 살아있는 baseline 모델*. 카테고리별 점수를 봐야 의미가 살아남.
- **관찰 3 — card_score 0.5.** description은 있으나 license가 명시 안 되었거나 그 반대. §13.5 모델 카드 룹브릭으로 확장 시 더 세밀한 신호 가능.
- **관찰 4 — inferenceProviderCount 0이지만 HF Spaces 100.** 외부 추론 서비스에 등록되지 않았지만 HF 내부 Spaces로는 이미 100+ 활용. Integration 67이 그 사이 위치.
- **시사점:** "유지보수 모드 + 광범위 사용" OSS의 흔한 패턴. 본 시스템은 이 패턴을 *Activity 0으로 정직하게 표시*합니다 — Activity를 0이 아닌 N/A로 처리하지 않은 이유는 "유지보수 모드"와 "측정 실패"의 구분이 사용자에게 중요하기 때문입니다.

### 10.5 4건 비교 — 패턴 요약

| 프로젝트 | 종류 | Composite | 두드러진 신호 | 약한 카테고리 |
|---|---|---:|---|---|
| pytorch/pytorch | 메가 ML 인프라 | 77 | Activity 85, Popularity 92 | Community insufficient, Star Quality 0% |
| facebook/react | 인프라화된 메가 OSS | 69 | Health 100, Popularity 93 | Social Buzz 22, Release downloads 0 |
| huggingface/transformers | 급성장 메가 OSS | 71 | Stars 159k, Community 87, cadence 6.7d | Social Buzz 27, Adoption release-side 약 |
| openai-community/gpt2 | frozen mega-model | 53 | Downloads 100, Spaces 100 | Activity 0, Social Buzz 0 |

**공통 시사점 3가지:**

1. **종합 점수만으로 의사결정하면 안 됩니다.** gpt2의 53과 react의 69는 자릿수가 비슷하지만 *완전히 다른 종류의 프로젝트*입니다. 카테고리별 점수가 1차 의사결정 단위.
2. **메가 OSS에서 Health는 식별력이 거의 없습니다.** 4개 모두 Health 87–100. 가중치 5의 정당성.
3. **R3 정직성**: 본 측정값은 2026-04-25의 스냅샷이며, "Active/Moderate" 라벨은 단순 임계값(80+ Vibrant, 60+ Active, 40+ Moderate, …)이지 절대 평가가 아닙니다.

---

## 11. Goodhart 위험과 보호 장치

본 시스템이 *측정 도구이자 게이밍 매뉴얼*로 동시에 작용할 위험이 있는 카테고리/메트릭과, 어떻게 보호되는가를 정리합니다.

### 11.1 가장 게이밍 위험이 큰 Top-3

| 메트릭 | 게이밍 시나리오 | 보호 장치 |
|---|---|---|
| `stars` (G1) | 봇 농장 / paid 별 | G8.1 Quality Star Score (`stars × avgUqs`) 와 G8.3 burstDetected 플래그가 별도 표시. 카테고리 점수 + Star quality assessment 카드 동반 노출. |
| `G3.3` issue close rate | stale-bot 자동 close, "wontfix" 일괄 close | G3.1, G3.2 절대값 동반 평가 (close rate 1.0이지만 issue 0개면 의미 없음). G4.4 PR author diversity와의 cross-check. |
| `G6.1` dependents | dependent inflation은 어렵지만 *fork inflation으로 stars/forks 부풀리기*는 가능 | G6.1은 dependent *저장소* 수이므로 fork와 직접 연결 안 됨. forks 지표는 Popularity 카테고리 내에서 stars/watchers와 균형. |

### 11.2 카테고리별 Goodhart 1줄 시나리오

- **Activity:** 봇 커밋(dependabot)으로 G2.5 부풀리기 → G2.2 외부 기여 비율과 G2.3_additions 라인 변화로 부분 방어.
- **Community:** stale-bot 일괄 close → G4.4 PR 작성자 다양성과 close *수* 동반 평가.
- **Adoption:** vendoring (subtree 복사)으로 dependents 누락 → underestimate되며, 게이밍이 아닌 measurement gap.
- **Health:** 빈 CONTRIBUTING.md 채우기 → 가중치 5로 의도적 영향력 제한.
- **Social Buzz:** HN voting ring → HN 알고리즘 자체 anti-gaming + composite 안에서 카테고리 가중 15.
- **HF Activity:** README만 수정해 commit_count 부풀리기 → 가능, 직접 보호 장치 없음.
- **HF Integration:** 빈 Space 100개 → HF Space 활성도 시그널 부재로 직접 보호 없음.

### 11.3 시스템 레벨 보호 — Insufficiency 게이트

§1.3의 30% 게이트는 게이밍이 아닌 *측정 실패*로부터 보호합니다. 한 collector가 죽거나 GraphQL secondary rate limit에 걸려도 (실제로 §10.1 pytorch에서 발생) 그 카테고리만 빠지고 나머지는 살아남아, 어떤 카테고리를 *충분히 측정 못했는가*가 사용자에게 노출됩니다.

---

## 12. 한계와 비목표

본 시스템이 측정하지 *않는* 것:

- **보안 (CVE, 의존성 위험, 패키지 무결성).** GitHub Advisory DB나 OSV 데이터를 통합하지 않습니다 — §13.2 OpenSSF Scorecard 권고.
- **코드 품질, 테스트 커버리지, CI 안정성.** 측정 가능하나 분석 시간 60s 제약상 미포함.
- **거버넌스와 자금 지속가능성.** OSS 프로젝트의 funding 모델, 메인테이너 보상, foundation 소속 여부.
- **라이선스 위험과 SBOM.** SPDX 식별자만 노출하며 컴플라이언스 평가 없음.
- **사용자 경험과 성능.** 라이브러리의 latency, throughput, DX는 측정 영역 밖.
- **사회적 영향력과 학술 인용.** Semantic Scholar/arXiv 인용은 §13.6 외부 신호로 후보화.
- **공급망 위험의 깊이.** dependents 수는 측정하지만, 해당 dependents의 *건강성*이나 critical infrastructure 분류는 별도 모델.
- **인적 리스크 (Truck Factor / Bus Factor).** 한 명이 떠나면 무너지는가 — §13.4 학계 지표로 후보.

본 시스템은 "*공개 신호로 측정 가능한 인기·활동·건강성의 1차 근사*"를 목표로 하며, 보안·거버넌스·품질의 종합 평가를 대체하지 않습니다.

---

## 13. 추가 가능 지표 — 리서치 카탈로그

각 후보 지표는 다음 5축으로 평가합니다:

1. **Hypothesis** — 어떤 질문에 답하는가
2. **Source/API** — 1차 출처 URL
3. **측정 정의** — 개념적 절차
4. **카테고리 매핑** — 기존 카테고리에 흡수 / 신규 카테고리 제안
5. **통합 권고** — yes / defer / skip + 한 줄 근거

### 13.1 Extension: CHAOSS 표준

출처: https://chaoss.community/kbtopic/all-metrics/ (Linux Foundation 산하 OSS 건강성 메트릭 표준).

| 지표 | Hypothesis | 측정 | 카테고리 매핑 | 통합 권고 |
|---|---|---|---|---|
| Time to First Response | "메인테이너 응답성의 1차 신호" | 이슈/PR 생성 → 메인테이너 첫 코멘트까지 시간의 분포 | Community 강화 | **yes** — github-search GraphQL에 timeline 추가 호출로 도입 가능 |
| Time to Close | "이슈 lifecycle 길이" | 이슈 생성 → close까지 분포 (median, p75, p95) | Community | **yes** — 이미 G3.x로 부분 측정, 분포로 확장 |
| Change Request Closure Ratio | "PR 처리량의 정상성" | PR open/merge/close 비율 | Community (G4.3와 중복) | **defer** — 기존 G4.3과 거의 동일 |
| Burstiness | "활동의 시간 분산" | 일/주별 카운트의 표준편차/Gini 계수 | Activity 신규 차원 | **defer** — G2.6 모멘텀과 일부 중복 |
| Code Change Lines | "변경 규모" | 추가/삭제 라인 분포 | Activity (G2.3와 중복) | **skip** — 이미 G2.3 |
| Contributor Diversity | "기여자 분포의 평등도" | 기여자별 commit 수 Gini | Activity 신규 차원 | **yes** — G2.2(owner share)에서 한 단계 정밀화 |

CHAOSS 페이지에 "Bus Factor"와 "New Contributor Onboarding Rate"는 별도 라벨로 노출되지 않으나, 학계 Truck Factor와 Newcomer Retention(§13.4)에 매핑됩니다.

### 13.2 Extension: OpenSSF Scorecard

출처: https://github.com/ossf/scorecard. 18+개의 자동 보안·거버넌스 체크. 본 시스템에 통합 가치가 높은 것:

| Check | 의미 | 카테고리 매핑 | 통합 권고 |
|---|---|---|---|
| Maintained | 최근 90일 내 커밋/이슈 활동 | Activity 보강 | **yes** — G2.6과 중복 일부, 이진 신호 추가 가능 |
| Code-Review | 머지 전 리뷰 비율 | Community 신규 | **yes** — G4.4(authors)와 직교 |
| Branch-Protection | 메인 브랜치 보호 정책 | 신규 **Governance** 카테고리 | **yes** — strategic |
| Pinned-Dependencies | 의존성 고정 여부 | 신규 **Security** 카테고리 | **yes** — strategic |
| SAST | 정적 분석 도입 | Security | **yes** |
| Vulnerabilities | 미해결 OSS 취약점 수 | Security | **yes** — 중요 |
| Token-Permissions | GitHub Actions 토큰 최소 권한 | Security | **yes** |
| Dangerous-Workflow | 위험 패턴 (예: pull_request_target + checkout) | Security | **yes** |

**통합 권고:** Health=5 가중치를 분해해 신규 **Security 카테고리(가중 5–10)** + Governance 카테고리(가중 5)를 도입. 현재 Health는 Community Health %만 보고 있어 다른 보안 차원을 잡지 못하므로, Scorecard 통합은 본 시스템의 가장 큰 *측정 표면 확장*.

### 13.3 Extension: OpenSSF Criticality Score

출처: https://github.com/ossf/criticality_score (Pike et al. 2020).

입력 신호 vs 본 시스템 매핑:

| Criticality 입력 | 본 시스템 | 격차 |
|---|---|---|
| `created_since` | createdAt 메타 | 점수에 반영 안 됨 (참고용) |
| `updated_since` | pushedAt 메타 / G2.6 모멘텀 | 부분 |
| `contributor_count` | G2.4 | 일치 |
| `org_count` | 미수집 | gap |
| `commit_frequency` | G2.5 | 일치 |
| `recent_releases_count` | G5.1 | 일치 |
| `closed_issues_count` | G3.2 | 일치 |
| `updated_issues_count` | 미수집 | gap |
| `comment_frequency` | 미수집 | gap |
| `dependents_count` (commit-message mention 기반) | G6.1 (network/dependents 페이지 기반) | **정의 차이** — Criticality는 commit message에 "uses X" 식으로 멘션된 횟수, 본 시스템은 GitHub의 dependent 저장소 페이지 카운트. 자릿수와 의미 모두 다름 |

**통합 권고:** 별도 "Criticality" 점수로 노출하지 말고 *Adoption 카테고리에 신규 메트릭으로 흡수* — `org_count`, `updated_issues_count`, `comment_frequency` 3개 추가가 quick win. **dependents 정의 차이는 사용자에게 명시 필요.**

### 13.4 Extension: Academic Research

직접 fetch 보류, 학계 논문 키워드와 지표만 카탈로그화. 실제 통합 시점에 원문 fetch 권장.

| 지표 | 출처 키워드 | 카테고리 매핑 | 통합 권고 |
|---|---|---|---|
| Truck Factor | Avelino et al. 2016 ("Truck factor: How many devs do we need to keep?") | 신규 **People-Risk** 또는 Health 확장 | **yes** — strategic, commit-author concentration 기반 |
| Newcomer Retention | Steinmacher et al. 2015 | Community 확장 | **yes** — quick win, "1st-time PR 머지자가 N개월 후에도 활동하는 비율" |
| PR Latency Decomposition | Yu et al. 2015 | Community (G4.5 정밀화) | **yes** — first-response/review/merge 3단계 분해 |
| Dependency Centrality (PageRank) | Decan et al. 2019 | Adoption 정밀화 | **defer** — npm/PyPI 그래프 전체 필요, 비용 큼 |
| Sentiment in Commit Messages | Pletea et al. 2014 | Community? | **skip** — false signal 위험, 문화적 편향 |
| Issue Lifecycle Distribution | Bissyandé et al. 2013 | Community 정밀화 | **yes** — G3 분포 형태 추가 |

### 13.5 Extension: HF 모델 카드 룹브릭

출처: https://huggingface.co/docs/hub/model-cards. 현재 `card_score`는 description+license 2축뿐. 13항목 권고 룹브릭으로 확장:

| 항목 | 가설 | 측정 | 통합 권고 |
|---|---|---|---|
| intended use | "용도 명시 = 오용 방지" | 섹션 존재 (regex/section heading) | yes |
| training data | "학습 데이터 출처 명시" | 섹션 존재 + 데이터셋 링크 카운트 | yes |
| limitations | "한계 솔직 공개" | 섹션 존재 | yes |
| ethical considerations | "윤리 평가 동반" | 섹션 존재 | yes |
| evaluation results | "벤치마크 등재" | YAML model-index 존재 | yes — strategic |
| environmental impact | "탄소 배출 명시" | YAML co2_eq_emissions 필드 | yes |
| citation | "BibTeX 제공" | 섹션 존재 | yes |
| license | "라이선스 명시" | 이미 측정 | (기존) |
| model architecture | "구조 명시" | YAML library_name + tags | yes |
| model size | "파라미터 수 명시" | tags / 본문 추출 | defer |
| dataset attribution | "데이터셋 인용" | datasets 필드 | yes |
| reproducibility | "재현성 가이드" | 섹션 존재 | yes |
| contact info | "연락처 명시" | 섹션 존재 | defer |

**통합 권고:** 현재 0/0.5/1 3-state를 13/13 수치로 확장. 가중치 1 그대로 유지하되 정밀도 ↑.

추가 HF 후보:

| 지표 | 가설 | 통합 권고 |
|---|---|---|
| Eval Benchmark 등재 수 | Open LLM Leaderboard, MTEB, lm-eval-harness 등재 | yes — strategic |
| Derived Models Count | `model.parent` 역참조로 파생 모델 수 | yes — Integration 정밀화 |
| Dataset Citations (Semantic Scholar) | 데이터셋이 논문에 인용된 횟수 | defer — API 필요 |
| Safety/Bias Eval Presence | 모델 카드에 safety eval 섹션 존재 | yes — quick win |

### 13.6 Extension: External Signals

| 지표 | 출처 | 카테고리 매핑 | 통합 권고 |
|---|---|---|---|
| PyPI / npm Downloads | https://libraries.io API, pypistats, npm-stat | Adoption 강력 보강 | **yes — quick win**. react Adoption 59의 release-asset 0 문제를 직접 해결 |
| GitHub Advisory (GHSA) | github.com/advisories | 신규 Security | yes (§13.2와 묶음) |
| SPDX License Compatibility | spdx.org/licenses + dep tree | 신규 Compliance | defer |
| Documentation Pageviews | Algolia DocSearch (when public) | 신규 사용 신호 | defer |
| arXiv / Semantic Scholar Mentions | semanticscholar.org/api | 신규 Academic Influence | defer |
| Conference Mentions | conference proceedings full-text search | 신규 | skip — 비용 큼 |

### 13.7 Extension: Roadmap (우선순위 매트릭스)

| Quadrant | 지표 |
|---|---|
| **Quick wins** (가치↑, 난이도↓) | Time to First Response, Newcomer Retention, libraries.io PyPI/npm downloads, HF Safety Eval Presence |
| **Strategic bets** (가치↑, 난이도↑) | OpenSSF Scorecard 통합 (Security 카테고리 신설), Truck Factor, HF Eval Benchmark 등재 |
| **Defer / Watch** | Sentiment, Documentation Pageviews, arXiv mentions |
| **Skip** | Conference mentions full-text, Sentiment in commits |

---

## 14. 통합 로드맵

본 시스템은 다음 순서로 진화하는 것을 권고합니다 (각 단계는 §13의 5축 평가 결과 반영):

1. **단기 (1–2주):** libraries.io PyPI/npm downloads 통합 (§13.6) → react/express 류 Adoption 정확성 향상.
2. **단기:** HF 모델 카드 룹브릭 13항목 (§13.5) → card_score 정밀화. 가중치 변경 없음.
3. **중기 (1–2개월):** OpenSSF Scorecard 부분 통합 → Health=5를 Health=3 + Security=5로 분해 (§13.2).
4. **중기:** CHAOSS Time to First Response (§13.1) → Community에 `G3.4` 추가.
5. **장기 (3–6개월):** Truck Factor / Newcomer Retention (§13.4) → People-Risk 신규 카테고리 또는 Health 확장.
6. **장기:** Eval Benchmark presence (§13.5) → HF Quality 신규 메트릭.
7. **계속 관찰:** Sentiment, arXiv mentions는 도입 비용 대비 신호 가치 미확인.

각 통합은 다음을 동반해야 합니다 (Goodhart 위험 관리):
- 신규 메트릭의 게이밍 시나리오 1줄을 §11에 추가
- 메가 OSS 4건(§10) 재측정으로 영향 시뮬레이션
- 가중치 변경 시 종합 점수 분포 회귀 테스트

---

## 15. 출처와 참고 문헌

### 1차 출처

- **CHAOSS Metrics**: https://chaoss.community/kbtopic/all-metrics/
- **OpenSSF Scorecard**: https://github.com/ossf/scorecard
- **OpenSSF Criticality Score**: https://github.com/ossf/criticality_score
- **Hugging Face Model Cards 가이드**: https://huggingface.co/docs/hub/model-cards
- **GitHub REST API**: https://docs.github.com/en/rest
- **GitHub GraphQL API**: https://docs.github.com/en/graphql
- **HN Algolia Search API**: https://hn.algolia.com/api

### 본 시스템 코드 진입점

| 영역 | 경로 |
|---|---|
| 점수 모델 | `src/lib/scoring/{config.ts,normalizer.ts,category-scores.ts,composite-score.ts}` |
| 수집기 | `src/lib/collectors/{github-graphql,github-rest,github-search,github-scraper,star-quality,huggingface,hackernews,reddit,stackoverflow,youtube}.ts` |
| 오케스트레이션 | `src/lib/orchestrator.ts`, `src/inngest/functions/analyze.ts` |
| 인프라 | `src/lib/{rate-limiter.ts,retry.ts,cache.ts}` |
| HTTP API | `src/app/api/{analyze,status/[id],report/[id],inngest}/route.ts` |
| 리포트 UI | `src/app/report/[platform]/[...slug]/page.tsx` |

### 학계 인용 키워드 (검증 후 사용 권장)

- Borges & Valente 2018 — "Why and how developers fork what from whom in GitHub"
- Kalliamvakou et al. 2014 — "The promises and perils of mining GitHub"
- Coelho & Valente 2017 — "Why modern open source projects fail"
- Decan et al. 2019 — "An empirical comparison of dependency network evolution in seven software packaging ecosystems"
- Avelino et al. 2016 — "A novel approach for estimating Truck Factors"
- Steinmacher et al. 2015 — "Social barriers faced by newcomers placing their first contribution in OSS projects"
- Yu et al. 2015 — "Wait for it: Determinants of pull request evaluation latency on GitHub"
- Bissyandé et al. 2013 — "Got issues? Who cares about it? A large scale investigation of issue trackers"
- Pletea et al. 2014 — "Security and emotion: sentiment analysis of security discussions on GitHub" (skip 후보, false signal 위험)
- Mockus & Herbsleb 2002 — "Two case studies of open source software development"
- Pike et al. 2020 — Criticality Score 블로그 (Google open source)
- Strathern 1997 — "'Improving ratings': audit in the British University system" (Goodhart's Law 변형)

### 본 시스템 README

- `README.md` — 빠른 시작, 환경 변수, API 키 발급, Vercel 배포 가이드.
- `PLAN.md` — 제품/아키텍처 결정 기록.

---

*문서 버전: 2026-04-25 통합본. 메가 OSS 측정값은 같은 일자 스냅샷이며 시간이 지나면 달라집니다.*
