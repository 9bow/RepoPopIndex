# RepoPopIndex

GitHub 저장소와 Hugging Face 모델/데이터셋의 **인기·활동·건강성**을 단일 점수(0–100)로 정량화하는 분석 도구입니다. URL 하나만 붙여 넣으면 여러 공식 API에서 메트릭을 수집·정규화·가중합산하여 카테고리별 세부 점수와 종합 점수를 보여주는 리포트를 생성합니다.

> 설계 원칙: **매 요청마다 fresh 수집**, **영구 DB 없음**, **불필요한 중간 산출물 저장 금지**. 결과 리포트는 Upstash Redis에 30일 TTL로만 보관됩니다.

---

## 빠른 시작

```bash
pnpm install
cp .env.example .env.local   # 토큰 채우기 (아래 환경 변수 참고)
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열고 저장소 URL을 입력하거나, 다음과 같이 직접 리포트 URL로 접근할 수 있습니다:

- `http://localhost:3000/report/github/vercel/next.js/3m`
- `http://localhost:3000/report/huggingface/meta-llama/Llama-3-8B/1m`

캐시에 결과가 있으면 즉시 표시되고, 없으면 idle 화면이 떠 명시적으로 분석을 시작할 수 있습니다 (GET이 자동으로 외부 API를 호출하지 않습니다).

리포트 페이지의 **PDF 다운로드** 버튼은 `window.print()`를 호출합니다. `@media print` 스타일이 헤더/네비/언어 스위처/툴팁/대화형 버튼을 숨기고, A4 페이지에 카드를 분할하지 않도록(`break-inside: avoid`) 정렬해 PDF로 깔끔히 저장됩니다.

### 환경 변수

| 변수 | 필수 | 용도 |
|---|---|---|
| `GITHUB_TOKEN` | ✅ | GitHub REST/GraphQL 인증 (5,000 req/h 풀) |
| `REDIS_URL`, `REDIS_TOKEN` | ✅ | Upstash Redis (캐시/큐/레이트 리미터/리포트 저장) |
| `HF_TOKEN` | ⛔ | Hugging Face 인증 (없어도 공개 메타는 호출 가능) |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | 배포 시 | Inngest Cloud로 분석을 백그라운드 실행 |
| `INNGEST_APP_ID` | 배포 시 | Inngest 대시보드 sync 후 표시되는 앱 ID (기본값: `repopopindex`) |
| `MAX_CONCURRENT_ANALYSES` | ⛔ | 동시 분석 수 (기본 5) |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT` | ⛔ | Reddit 소셜 수집기 (없으면 HN만 사용) |
| `STACKEXCHANGE_KEY` | ⛔ | Stack Overflow 수집기 쿼터 상향 (없어도 300 req/day 익명 가능) |
| `YOUTUBE_API_KEY` | ⛔ | YouTube Data API v3 수집기 (없으면 건너뜀) |

---

## API 키 발급 가이드

### GitHub Personal Access Token (`GITHUB_TOKEN`)

1. GitHub 우측 상단 프로필 → **Settings** → 좌측 하단 **Developer settings** → **Personal access tokens → Tokens (classic)**
2. **Generate new token (classic)** 클릭
3. Note: `repopopindex` (식별용)
4. Expiration: 원하는 기간 설정 (90일 권장)
5. Scopes: **`public_repo`** 하나만 체크 (공개 저장소 분석 시), 비공개 저장소 분석이 필요하면 `repo` 전체 선택
6. **Generate token** → 발급된 토큰(`ghp_...`) 복사

> Fine-grained token도 사용 가능합니다. 이 경우 **Repository permissions → Contents: Read-only** 및 **Metadata: Read-only** 를 부여하면 됩니다.

### Upstash Redis (`REDIS_URL`, `REDIS_TOKEN`)

1. [https://console.upstash.com](https://console.upstash.com) 접속 후 회원가입 또는 로그인
2. **Create Database** 클릭
3. Name: `repopopindex`, Region: 서비스 지역에 가장 가까운 곳 선택, Type: **Regional**
4. 생성 후 데이터베이스 상세 화면의 **REST API** 탭으로 이동
5. `.env` 섹션에서 `UPSTASH_REDIS_REST_URL`을 `REDIS_URL`로, `UPSTASH_REDIS_REST_TOKEN`을 `REDIS_TOKEN`으로 사용

### Inngest (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `INNGEST_APP_ID`)

로컬 개발 시에는 Inngest Dev Server가 자동으로 처리하므로 키가 필요 없습니다.

**Vercel 배포 시에만** 필요:

1. [https://app.inngest.com](https://app.inngest.com) 회원가입 또는 로그인
2. **Create App** → 앱 이름 입력
3. **Event Keys** 탭 → **Create Event Key** → 발급된 키가 `INNGEST_EVENT_KEY`
4. **Signing Key** 탭에 표시된 키가 `INNGEST_SIGNING_KEY`
5. Vercel에 배포 후 Inngest 대시보드 **Apps** → **Sync App** → URL 입력(`https://your-domain.vercel.app/api/inngest`) → Sync 완료 후 표시되는 **App ID**가 `INNGEST_APP_ID`

---

### 선택적 소셜 수집기 (dark-launch)

Reddit, Stack Overflow, YouTube 수집기는 **자격 정보가 있을 때만** 동작합니다. Reddit OAuth 환경변수(`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`)가 설정되지 않으면 Reddit 지표는 건너뛰고, S1(소셜 화제도) 카테고리의 가중치를 사용 가능한 소스 기준으로 **비례 재정규화**하여 종합 점수를 산출합니다. 자격 정보가 없으면 빈 결과로 통과되고 파이프라인은 HackerNews만으로 진행됩니다.

#### Reddit (`REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_USER_AGENT`)

1. Reddit 계정으로 [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) 접속
2. 하단 **create another app...** 클릭
3. 설정:
   - Name: `repopopindex` (임의)
   - 타입: **script** 선택
   - redirect uri: `http://localhost:8080` (script 타입은 사용 안 되지만 필수 입력)
4. **create app** 클릭
5. 앱 이름 바로 아래 짧은 문자열이 `REDDIT_CLIENT_ID`, **secret** 필드가 `REDDIT_CLIENT_SECRET`
6. `REDDIT_USER_AGENT`는 Reddit API 정책에 따라 아래 형식으로 작성:
   ```
   web:com.example.repopopindex:v1.0 (by /u/your_reddit_handle)
   ```
   > Generic UA(`python-requests`, `axios` 등)는 자동 차단됩니다. 반드시 위 형식 준수.

#### Stack Overflow / Stack Exchange (`STACKEXCHANGE_KEY`)

익명 상태에서도 300 req/IP/day 사용 가능하므로 발급 없이 시작해도 됩니다. 10,000 req/day 쿼터가 필요하면:

1. Stack Overflow 계정으로 [https://stackapps.com/apps/oauth/register](https://stackapps.com/apps/oauth/register) 접속
2. 양식 입력:
   - Application Name: `RepoPopIndex`
   - Description: 임의
   - OAuth Domain: `localhost` (로컬) 또는 Vercel 도메인
3. **Register Your Application** 클릭
4. 결과 화면에서 **Key** 값 복사 → `STACKEXCHANGE_KEY`
   > `Client Id`가 아닌 **Key** 필드임에 주의

#### YouTube Data API v3 (`YOUTUBE_API_KEY`)

1. [https://console.cloud.google.com](https://console.cloud.google.com) 접속 후 Google 계정 로그인
2. 상단 프로젝트 선택기 → **NEW PROJECT** → 이름 입력 후 생성
3. 좌측 메뉴 **APIs & Services → Library** 클릭
4. 검색창에 `YouTube Data API v3` 입력 → 결과 클릭 → **ENABLE**
5. **APIs & Services → Credentials** 클릭 → **CREATE CREDENTIALS → API key**
6. 발급된 키 복사 → `YOUTUBE_API_KEY`
7. (권장) 키 우측 편집 아이콘 → **API restrictions → Restrict key** → `YouTube Data API v3` 선택 후 저장

> 기본 쿼터: 10,000 unit/day. 분석당 약 101 unit 소모. 쿼터 증설은 Google Cloud 콘솔에서 신청 가능.

---

## 아키텍처

```
사용자 입력 URL
   │
   ▼
POST /api/analyze ──► Redis Queue (zset, max 20) ──► Inngest event "analysis/run"
                                                             │
                                                             ▼
                                                     orchestrator.runAnalysis
                                                             │
                       ┌────────────┬────────────┬───────────┼──────────────┬──────────────┐
                       ▼            ▼            ▼           ▼              ▼              ▼
              GitHub GraphQL  GitHub Search  GitHub REST  Dependents   Star Quality  HackerNews
              (G1, G2.5)     (G3, G4)       (G2, G5, G7) (G6)         (G8)          (S1)
                       │            │            │           │              │              │
                       └────────────┴────────────┴───────────┴──────────────┴──────────────┘
                                                             │
                                                             ▼
                                                       정규화 + 가중평균
                                                             │
                                                             ▼
                              setReport(rpi:report:{platform}:{owner}/{repo}:{period}, ttl=30d)
                                                             │
                                                             ▼
GET /report/[platform]/[...slug]  ──► getReport() ──► 캐시 히트 시 즉시 렌더 / 미스 시 idle UI
```

수집기는 `Promise.allSettled`로 동시에 실행되며 각 호출은 15초 timeout으로 보호됩니다. 한 수집기가 실패해도 나머지 카테고리는 살아남고, 카테고리의 가용 메트릭이 30% 미만이면 그 카테고리는 `insufficient`로 표시되어 종합 점수에서 제외됩니다 (`MIN_AVAILABLE_RATIO = 0.3`).

### 저장소 구조 (단일 저장소)

이 프로젝트는 **Postgres가 없습니다.** 모든 상태는 Upstash Redis에 살며, 키 네임스페이스는 다음과 같습니다 (자세한 내용은 `src/lib/cache.ts` 상단 주석):

| 키 패턴 | 용도 | TTL |
|---|---|---|
| `rpi:report:{platform}:{owner}/{repo}:{period}` | 완료된 분석 리포트 | 30일 |
| `rpi:analysis:{id}` | 진행 중 분석의 메타 (status/error/completedAt) | 30일 |
| `rpi:progress:{id}` | 진행률 폴링용 라이브 업데이트 | 10분 |
| `rpi:queue` | 분석 큐 (sorted set, 최대 20) | 1시간 sliding |
| `rpi:rate:{source}` | 소스별 레이트 리미터 카운터 | window별 |

### URL 라우팅

| 경로 | 동작 |
|---|---|
| `/` | 홈. URL 입력 → 캐노니컬 리포트 URL로 이동 |
| `/report/[platform]/[...slug]` | 리포트 페이지. catch-all 슬러그가 `owner/repo/period`를 파싱 (HF는 owner에 `/`가 포함될 수 있음) |
| `/api/analyze` | POST: 분석 시작 (큐에 enqueue + Inngest 트리거) |
| `/api/status/[id]` | GET: 진행률 + 큐 위치 |
| `/api/inngest` | Inngest 웹훅 |

리라이트:
- `/report/github.com/...` → `/report/github/...`
- `/report/huggingface.co/...` → `/report/huggingface/...`

### 재시도 정책

전송 계층 `fetchWithRetry`(`src/lib/retry.ts`)는 **403, 408, 429, 5xx**에 대해 지수 백오프(2s → 4s → 8s, max 30s, 최대 3회)로 자동 재시도합니다. 403을 retry 목록에 포함시킨 이유: GitHub의 secondary rate limit은 429가 아닌 **403**으로 응답하기 때문입니다.

`github-search` 수집기는 한 단계 더 위에서 collector-level 재시도(1s → 3s, 최대 3회)를 수행합니다. GraphQL이 HTTP 200으로 응답하면서 일부 alias만 errors 배열에 들어가는 partial 응답을 감지하여 재시도하며, 끝까지 실패하면 부분 데이터 대신 명시적인 null + error를 반환해 Community 점수가 한 alias 실패로 무너지지 않도록 합니다.

---

## GitHub 메트릭 수집

### 1) `github-graphql` — Fundamentals + 기간 활동 카운트

**엔드포인트:** GraphQL `https://api.github.com/graphql` (단일 쿼리, `hasDiscussionsEnabled=false` 시 폴백 쿼리 사용)

| 메트릭 키 | 카테고리 | 의미 | 출처 필드 |
|---|---|---|---|
| `stars` | G1/Popularity | 전체 별 수 | `stargazerCount` |
| `forks` | G1/Popularity | 전체 포크 수 | `forkCount` |
| `watchers` | G1/Popularity | watcher 수 | `watchers.totalCount` |
| `G2.5` | G2/Activity | 기간 내 커밋 수 | `defaultBranchRef.target.history(since).totalCount` |
| (메타) | G1 | 라이선스, 주 언어, 생성·푸시 시각 | `licenseInfo.spdxId`, `primaryLanguage`, `createdAt`, `pushedAt` |

### 2) `github-search` — Issue/PR 동작 (단일 GraphQL 다중 alias)

**엔드포인트:** GraphQL search (4개 검색 query를 alias로 묶어 1번 호출). REST `/search/issues`는 동시 분석 시 secondary rate limit(403)으로 재시도되지 않아 Community 카테고리 전체가 N/A로 무너지는 문제가 있어 GraphQL alias로 통합되었습니다 (커밋 `ddc70de`). 추가로 partial-error 재시도가 적용되어 한 alias 실패로 카테고리가 무너지는 케이스를 차단합니다.

| 메트릭 키 | 카테고리 | 정의 |
|---|---|---|
| `G3.1` | G3/Community | 기간 내 신규 이슈 수 (`type:issue created:>{since}`) |
| `G3.2` | G3 | 기간 내 종료 이슈 수 (`type:issue closed:>{since}`) |
| `G3.3` | G3 | 이슈 종료율 = `G3.2 / G3.1` (linear, 0–1) |
| `G4.1` | G4/Community | 기간 내 신규 PR 수 (`type:pr created:>{since}`) |
| `G4.2` | G4 | 기간 내 머지 PR 수 (`type:pr merged:>{since}`) |
| `G4.3` | G4 | PR 머지율 = `G4.2 / G4.1` (linear, 0–1) |
| `G4.4` | G4 | 머지 PR 30개 샘플의 **고유 작성자 수** (외부 기여자 다양성) |
| `G4.5` | G4 | 머지 PR의 **중앙값 머지 소요일** (낮을수록 좋음 → `inverse: true`) |

### 3) `github-rest` — 활동 통계 + 릴리즈 + 커뮤니티 프로파일

**엔드포인트:** REST 6개 (병렬)

| 메트릭 키 | 카테고리 | 정의 | 엔드포인트 |
|---|---|---|---|
| `G2.4` | G2/Activity | 누적 기여자 수 (Link 헤더 last page) | `/contributors?per_page=1&anon=true` |
| `G2.1` | G2 | 52주 총 커밋 수 (참고용, 가중치 0) | `/stats/participation` |
| `G2.2` | G2 | 외부 기여자 비율 = `1 − owner/all` (linear, 0–1) | `/stats/participation` |
| `G2.3_additions` | G2 | 기간 내 코드 추가 라인 수 | `/stats/code_frequency` |
| `G2.6` | G2 | 활동 추세 = `최근 4주 합 / 직전 4주 합` (>1이면 가속) | `/stats/participation` |
| `G5.1` | G5/Adoption | 기간 내 릴리즈 수 | `/releases?per_page=100` |
| `G5.2` | G5 | 릴리즈 평균 간격(일, 짧을수록 좋음, `inverse`) | `/releases` |
| `G5.3` | G5 | 기간 내 릴리즈 다운로드 합 | `/releases` |
| `G5.4` | G5 | 누적 태그 수 (참고용, 가중치 0) | `/tags` |
| `G7.1` | G7/Health | GitHub Community Health Score (0–100) | `/community/profile` |
| `G7.2`/`G7.3`/`G7.4` | G7 | CONTRIBUTING/CoC/README 존재 여부 | `/community/profile` |

### 4) `github-scraper` — Dependent 저장소 수

**소스:** `https://github.com/{owner}/{repo}/network/dependents` HTML 파싱 (공식 API 미제공)

| 메트릭 키 | 카테고리 | 정의 |
|---|---|---|
| `G6.1` | G6/Adoption | "Used by N Repositories" 숫자 정규식 추출 (`maxI = 5,000,000`) |

### 5) `star-quality` — 별 품질 보정 (G8)

봇/이벤트 폭주를 보정하기 위해 **최근 100명의 stargazer 프로필**을 GraphQL로 가져와 사용자 품질 점수(UQS)를 계산합니다.

```ts
function computeUqs(node, now) {
  const ageDays = (now - createdAt) / 86400000;
  if (ageDays < 7 || (followers === 0 && repos === 0)) return 0; // 봇 휴리스틱
  const A = min(1, ageDays / 730);                  // 계정 나이 (2년 만점)
  const F = min(1, log(1 + followers) / log(101));  // 팔로워
  const R = min(1, log(1 + repos) / log(31));       // 보유 저장소
  return 0.4 * A + 0.3 * F + 0.3 * R;
}
```

| 메트릭 키 | 카테고리 | 정의 |
|---|---|---|
| `G8.1` | G8/Popularity | **Quality Star Score** = `totalStars × avgUqs` |
| `G8.2` | G8 | 최근 별 도착률 (개/일) |

별 폭주 감지: 일별 카운트 중 `> 평균 × 5`가 있으면 `burstDetected=true` 플래그가 리포트에 표시됩니다.

---

## Hugging Face 메트릭 수집

**엔드포인트:** `https://huggingface.co/api/{models|datasets}/{owner}/{repo}` (모델 → 404면 dataset로 폴백)

| 메트릭 키 | 카테고리 | 정의 | 정규화 maxI |
|---|---|---|---|
| `likes` | H1/Popularity | 좋아요 수 (cumulative) | 5,000 (log) |
| `downloads` | H1/Downloads | HF 공식 다운로드 통계, 최근 30일 | 10,000,000 (log) |
| `downloadsAllTime` | H1/Downloads | HF 공식 다운로드 통계, 생성 이후 누적 (cumulative) | 100,000,000 (log) |
| `trendingScore` | H1/Popularity | HF가 제공하는 트렌딩 점수 | 100 (log) |
| `spaces_count` | H2/Integration | 모델을 사용하는 Spaces 수 | 100 (log) |
| `inferenceProviderCount` | H2 | Inference provider 매핑 수 | 10 (log) |
| `commit_count` | H3/Activity | 기간 내 커밋 수 (commits API 페이지네이션, 최대 10페이지) | 500 (log) |
| `unique_contributors` | H3 | 커밋 작성자 고유 수 | 50 (log) |
| `days_since_last_commit` | H3 | 마지막 커밋부터 경과 일 (`inverse`) | 365 (log) |
| `discussion_count` | H4/Community | discussions API 총 수 | 100 (log) |
| `pr_count` | H4 | discussions 중 `type=pull_request` | 50 (log) |
| `card_score` | H4 | description+license 둘 다 1.0, 하나만 0.5, 없음 0 (linear) | 1.0 |

HF 다운로드 통계는 Hub가 파일을 제공하는 서버 쪽에서 집계합니다. 모델 저장소마다 라이브러리별 query file을 기준으로 하며, 기본값은 `config.json` 계열 파일이고 `GET`뿐 아니라 `HEAD` 요청도 다운로드로 카운트됩니다. 따라서 RepoPopIndex는 이 값을 **활성 사용·채택 신호**로 활용하되, 고유 사용자 수나 순수한 maintainer activity로 해석하지 않습니다. 그런 이유로 다운로드는 `H-Downloads`(가중치 25)에 두고, 커밋·기여자·마지막 커밋 경과일은 별도 `H-Activity`로 분리합니다.

좋아요 신호도 다운로드/좋아요 비율 기반의 `hfQualityFactor`로 보정해 `qualityLikeScore = likes × max(0.3, hfQualityFactor)`를 함께 보관합니다.

---

## Hacker News 사회적 화제도 (S1, 두 플랫폼 공통)

**엔드포인트:** `https://hn.algolia.com/api/v1/search?query=...&tags=story&numericFilters=created_at_i>{since}`

쿼리는 `github.com/{owner}/{repo}` 또는 `huggingface.co/{owner}/{repo}`로 자동 구성됩니다.

| 메트릭 키 | 카테고리 | 정의 |
|---|---|---|
| `story_count` | S1/Social Buzz | 기간 내 등록된 스토리 수 |
| `total_points` | S1 | 스토리 포인트 합계 |
| `total_comments` | S1 | 댓글 합계 (참고용) |
| `engagement` | S1 | `points × 1.0 + comments × 1.5` (composite) |
| `top_story` | S1 | 가장 높은 점수의 스토리 (제목/URL/포인트, 리포트에 카드로 표시) |

---

## 정규화 (Normalization)

모든 메트릭은 0–1 범위로 변환된 뒤 가중합산됩니다.

```ts
// src/lib/scoring/normalizer.ts
function normalize(raw, config) {
  let v = raw;
  if (config.inverse) v = max(0, config.maxI - raw);   // 낮을수록 좋은 메트릭
  if (config.linear)  return min(1, v / config.maxI);  // 비율·0–1 메트릭용
  return min(1, log(1 + v) / log(1 + config.maxI));    // 그 외 (heavy-tail에 적합)
}
```

- **로그 정규화**가 기본 — stars, downloads, dependents 등 멱법칙 분포 메트릭에서 상위 OSS가 점수 천장에 부드럽게 도달합니다.
- **선형 정규화** (`linear: true`)는 0–1 비율 (close ratio, merge ratio, owner-share) 또는 health score처럼 본래 bounded인 메트릭에 사용됩니다.
- **역방향** (`inverse: true`)은 머지 소요일·릴리즈 간격·마지막 커밋 경과일 등 "작을수록 좋음" 메트릭에 적용됩니다.

### Recency Factor (cumulative ↔ flow 균형)

`cumulative: true` 메트릭(누적 stars, dependents 등)에는 `RECENCY_FACTOR = 0.75`를 곱해 시간이 흐른 stock 신호를 약화하고, 기간 내 flow 신호(커밋·PR·리뷰)에 상대적 가중을 줍니다. 카테고리 점수는 "그 카테고리에서 데이터가 있는 메트릭들의 이론적 최댓값"으로 재스케일되므로(`metricCeiling()`), cumulative 메트릭만으로 구성된 카테고리도 100점에 도달할 수 있습니다.

### 카테고리 가중치 → 종합 점수

`composite_score = Σ (category.weight × category.score) / Σ category.weight`

#### GitHub (`src/lib/scoring/config.ts:95`)

| 카테고리 | 가중치 | 메트릭 |
|---|---|---|
| **Adoption** | 25 | `G6.1` (의존 저장소), `G5.1`–`G5.4` (릴리즈) |
| **Activity** | 20 | `G2.4`/`G2.5`/`G2.2`/`G2.3_additions`/`G2.6` |
| **Community** | 20 | `G3.x` (이슈), `G4.x` (PR) |
| **Popularity** | 15 | `stars`, `forks`, `watchers`, `G8.1`/`G8.2` (별 품질) |
| **Social Buzz** | 15 | `story_count`, `total_points`, `engagement` (HN) |
| **Health** | 5 | `G7.1` (Community Health Score) |

#### Hugging Face (`src/lib/scoring/config.ts:134`)

| 카테고리 | 가중치 | 메트릭 |
|---|---|---|
| **Downloads** | 25 | `downloads`, `downloadsAllTime` |
| **Activity** | 20 | `commit_count`, `unique_contributors`, `days_since_last_commit` |
| **Integration** | 20 | `spaces_count`, `inferenceProviderCount` |
| **Social Buzz** | 15 | HN 메트릭 |
| **Community** | 10 | `discussion_count`, `pr_count`, `card_score` |
| **Popularity** | 10 | `likes`, `trendingScore` |

`MIN_AVAILABLE_RATIO = 0.3` — 카테고리의 weighted 메트릭 중 30% 미만만 데이터가 있으면 그 카테고리는 `insufficient`로 표시되어 종합 점수에서 제외됩니다 (한 API 장애가 종합 점수를 크게 왜곡하지 않도록).

---

## 기술 스택

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **TypeScript** (strict)
- **Tailwind CSS 4** + Base UI / shadcn 컴포넌트
- **Recharts** (radar/gauge 차트)
- **Inngest** (백그라운드 분석 실행 + 동시성 제한)
- **Upstash Redis** (큐 + 캐시 + 레이트 리미터 + 리포트 저장)
- **Cheerio** (Dependents HTML 파싱)
- **Zod v4** (입력 검증)

---

## 배포

Vercel + Upstash Redis + Inngest Cloud 조합을 기본으로 가정합니다. 빌드 시 마이그레이션 단계가 없습니다 (`pnpm build` = `next build`만).

```bash
pnpm build
pnpm start
```

### Vercel Production 환경변수 설정

#### 방법 1 — Vercel 대시보드 (권장)

1. [https://vercel.com/dashboard](https://vercel.com/dashboard) 에서 프로젝트 선택
2. **Settings** 탭 → 좌측 **Environment Variables** 클릭
3. 아래 변수들을 하나씩 추가 (Environment: **Production** 선택):

| 변수 | 값 |
|---|---|
| `GITHUB_TOKEN` | `ghp_...` |
| `REDIS_URL` | Upstash REST URL (`https://...upstash.io`) |
| `REDIS_TOKEN` | Upstash REST Token |
| `INNGEST_EVENT_KEY` | Inngest Event Key |
| `INNGEST_SIGNING_KEY` | Inngest Signing Key |
| `INNGEST_APP_ID` | Inngest App ID (Sync 후 확인) |
| `HF_TOKEN` | (선택) Hugging Face 토큰 |
| `REDDIT_CLIENT_ID` | (선택) Reddit 앱 Client ID |
| `REDDIT_CLIENT_SECRET` | (선택) Reddit 앱 Secret |
| `REDDIT_USER_AGENT` | (선택) `web:com.example.repopopindex:v1.0 (by /u/handle)` |
| `STACKEXCHANGE_KEY` | (선택) StackApps Key |
| `YOUTUBE_API_KEY` | (선택) Google Cloud API Key |
| `MAX_CONCURRENT_ANALYSES` | (선택) 기본값 `5` |

4. 모두 추가 후 **Redeploy** — 환경변수는 재배포 시 반영됩니다.

#### 방법 2 — Vercel CLI

```bash
# CLI 설치 및 로그인
npm i -g vercel
vercel login

# 프로젝트 연결 (최초 1회)
vercel link

# 환경변수 추가 (프롬프트에서 값 입력)
vercel env add GITHUB_TOKEN production
vercel env add REDIS_URL production
vercel env add REDIS_TOKEN production
vercel env add INNGEST_EVENT_KEY production
vercel env add INNGEST_SIGNING_KEY production
vercel env add INNGEST_APP_ID production

# 선택적 소셜 수집기
vercel env add REDDIT_CLIENT_ID production
vercel env add REDDIT_CLIENT_SECRET production
vercel env add REDDIT_USER_AGENT production
vercel env add STACKEXCHANGE_KEY production
vercel env add YOUTUBE_API_KEY production

# 설정된 환경변수 확인
vercel env ls production

# 재배포로 적용
vercel --prod
```

> `vercel env pull .env.local` 명령으로 Production 환경변수를 로컬 `.env.local`로 내려받을 수 있습니다 (민감 정보 포함되므로 `.gitignore` 확인).

### Inngest 웹훅 연동 (배포 후)

Vercel 배포 완료 후 Inngest와 연동해야 백그라운드 분석이 동작합니다:

1. [https://app.inngest.com](https://app.inngest.com) → **Apps** → **Sync New App**
2. App URL 입력: `https://your-project.vercel.app/api/inngest`
3. Sync 완료 후 표시되는 **App ID**를 Vercel 환경변수 `INNGEST_APP_ID`에 추가
4. Vercel에서 **Redeploy** (환경변수 반영)

---

## 디자인 노트

- **DB 미사용 결정** — 모든 PG 쿼리가 `where id = ?` 단건 룩업이었고, raw_metrics는 작성 후 한 번도 읽히지 않았습니다. 영속성이 필요한 유일한 데이터는 "완료된 리포트"이며, 이는 결정적 캐시 키(`rpi:report:{platform}:{owner}/{repo}:{period}`)로 자연스럽게 dedup되어 30일 TTL Redis로 충분합니다 (커밋 `abcc711`).
- **GET-safe 라우팅** — `/report/...` GET은 절대로 외부 API를 호출하거나 분석을 시작하지 않습니다. 캐시 미스 시에는 idle UI를 보여주고, 사용자가 "Run Analysis" 버튼을 눌러야만 POST가 발사됩니다 (봇/크롤러로 인한 GitHub 쿼터 소진 방지).
- **단일 GraphQL 호출 + partial 재시도** — github-search는 4개 검색을 alias로 묶어 1번에 처리하며, alias-level partial 실패까지 재시도해 Community 점수가 일시적 GraphQL 흔들림으로 무너지지 않도록 합니다.
- **Star Quality** — 단순 별 수가 아닌 stargazer 프로필 기반 UQS로 인기와 신뢰도를 분리합니다. burst 감지로 의심스러운 폭증을 리포트에 명시합니다.
