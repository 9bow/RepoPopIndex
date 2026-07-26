import type { Locale } from "./dictionary";

/**
 * Per-metric copy for the report: short row label (2–4 words) and a longer
 * explanation shown on hover (native `title` tooltip).
 */
const METRIC_COPY: Record<
  string,
  { short: { en: string; ko: string }; desc: { en: string; ko: string } }
> = {
  // GitHub — fundamentals
  stars: {
    short: { en: "Star count", ko: "별점 수" },
    desc: {
      en: "Total GitHub stars; measures broad recognition of the repository.",
      ko: "GitHub 별점 총개수입니다. 저장소가 얼마나 널리 알려졌는지 보여줍니다.",
    },
  },
  forks: {
    short: { en: "Fork count", ko: "포크 수" },
    desc: {
      en: "Number of repository forks, indicating reuse and experimentation.",
      ko: "포크 수. 코드 재사용·실험에 대한 관심을 나타냅니다.",
    },
  },
  watchers: {
    short: { en: "Watchers", ko: "Watcher(관찰자) 수" },
    desc: {
      en: "Users watching the repo for activity notifications.",
      ko: "활동 알림을 구독하는 사용자 수입니다.",
    },
  },
  created_at: {
    short: { en: "Repository created", ko: "저장소 생성일" },
    desc: {
      en: "The repository creation timestamp returned by GitHub.",
      ko: "GitHub이 반환한 저장소 최초 생성 시각입니다.",
    },
  },
  pushed_at: {
    short: { en: "Last pushed", ko: "최근 푸시" },
    desc: {
      en: "The latest timestamp at which GitHub recorded a push to the repository.",
      ko: "GitHub이 저장소의 푸시를 마지막으로 기록한 시각입니다.",
    },
  },
  open_issues: {
    short: { en: "Open issues", ko: "열린 이슈" },
    desc: {
      en: "Current number of open issues reported by GitHub at collection time.",
      ko: "수집 시점에 GitHub이 보고한 현재 열린 이슈 수입니다.",
    },
  },
  open_prs: {
    short: { en: "Open pull requests", ko: "열린 PR" },
    desc: {
      en: "Current number of open pull requests reported by GitHub at collection time.",
      ko: "수집 시점에 GitHub이 보고한 현재 열린 풀 리퀘스트 수입니다.",
    },
  },
  has_issues_enabled: {
    short: { en: "Issues enabled", ko: "이슈 기능 사용" },
    desc: {
      en: "Whether the repository has GitHub Issues enabled: 1 means enabled and 0 means disabled.",
      ko: "GitHub Issues 기능 사용 여부입니다. 1은 사용, 0은 사용 안 함입니다.",
    },
  },
  description: {
    short: { en: "Description", ko: "저장소 설명" },
    desc: {
      en: "The public repository description returned by GitHub.",
      ko: "GitHub이 반환한 공개 저장소 설명입니다.",
    },
  },
  primary_language: {
    short: { en: "Primary language", ko: "주요 언어" },
    desc: {
      en: "The programming language GitHub identifies as the repository’s primary language.",
      ko: "GitHub이 저장소의 주요 언어로 판별한 프로그래밍 언어입니다.",
    },
  },
  // G2 activity
  "G2.1": {
    short: { en: "Commits (window)", ko: "커밋(기간)" },
    desc: {
      en: "Total commit count in the selected time window (participation heatmap).",
      ko: "선택한 기간 동안의 커밋 총합(참여 히트맵 기반)입니다.",
    },
  },
  "G2.2": {
    short: { en: "Ext. contributor share", ko: "외부 기여 비율" },
    desc: {
      en: "Share of commits from people other than the repo owner; higher means more open contribution.",
      ko: "소유자가 아닌 기여자의 커밋 비중. 높을수록 열린 기여가 많습니다.",
    },
  },
  "G2.3_additions": {
    short: { en: "Code additions", ko: "추가 라인" },
    desc: {
      en: "Lines of code added in the period (from repository code frequency).",
      ko: "해당 기간에 추가된 코드 라인 수(코드 빈도 데이터 기준)입니다.",
    },
  },
  "G2.3_deletions": {
    short: { en: "Code deletions", ko: "삭제 라인" },
    desc: {
      en: "Lines removed in the period; shown when raw data is available.",
      ko: "기간 중 삭제된 코드 라인 수입니다(원시 데이터가 있을 때 표시).",
    },
  },
  "G2.4": {
    short: { en: "Contributors", ko: "기여자 수" },
    desc: {
      en: "Cumulative number of contributors listed by GitHub for the repository. This is not limited to the selected analysis period.",
      ko: "GitHub이 저장소에 표시하는 누적 기여자 수입니다. 선택한 분석 기간으로 제한된 값은 아닙니다.",
    },
  },
  "G2.5": {
    short: { en: "GraphQL commits", ko: "GraphQL 커밋" },
    desc: {
      en: "Commit count as reported via GitHub’s GraphQL API (may overlap with other G2 signals).",
      ko: "GraphQL로 조회한 커밋 수(다른 G2 지표와 일부 겹칠 수 있음)입니다.",
    },
  },
  "G2.6": {
    short: { en: "Activity momentum", ko: "활동 모멘텀" },
    desc: {
      en: "Ratio of recent vs prior 4 weeks of commit activity. Values above 1 mean a faster recent pace.",
      ko: "최근 4주의 커밋 수를 그 이전 4주와 비교합니다. 1보다 크면 활동이 가속, 작으면 둔화로 해석합니다.",
    },
  },
  // G3 issues
  "G3.1": {
    short: { en: "Issues opened", ko: "이슈 오픈" },
    desc: {
      en: "Issues created in the period (search-based signal).",
      ko: "기간 중 생성된 이슈 수(검색 기반)입니다.",
    },
  },
  "G3.2": {
    short: { en: "Issues closed", ko: "이슈 닫힘" },
    desc: {
      en: "Issues closed in the period.",
      ko: "기간 중 닫힌 이슈 수입니다.",
    },
  },
  "G3.3": {
    short: { en: "Issue close rate", ko: "이슈 닫힘률" },
    desc: {
      en: "How many opened issues in the period were also closed, as a 0–1 rate.",
      ko: "열렸다가 닫힌 이슈에 대한 닫힘 비율(0~1)입니다.",
    },
  },
  "G3.4": {
    short: { en: "First human response", ko: "첫 사람 응답시간" },
    desc: {
      en: "Median days from issue creation to the first non-bot comment by someone other than the issue author, sampled from the latest 30 issues. Lower is faster.",
      ko: "최근 이슈 30개 표본에서 작성자 본인과 봇을 제외한 첫 댓글까지 걸린 시간의 중앙값(일)입니다. 짧을수록 빠릅니다.",
    },
  },
  // G4 PRs
  "G4.1": {
    short: { en: "PRs opened", ko: "PR 오픈" },
    desc: {
      en: "Pull requests opened in the period.",
      ko: "기간 중 열린 풀 리퀘스트 수입니다.",
    },
  },
  "G4.2": {
    short: { en: "PRs merged", ko: "PR 머지" },
    desc: {
      en: "Pull requests merged in the period.",
      ko: "기간 중 머지된 풀 리퀘스트 수입니다.",
    },
  },
  "G4.3": {
    short: { en: "PR merge rate", ko: "PR 머지율" },
    desc: {
      en: "Share of PRs in the period that were merged, 0–1.",
      ko: "해당 PR 중 머지된 비율(0~1)입니다.",
    },
  },
  "G4.4": {
    short: { en: "PR author diversity", ko: "PR 작성자 수" },
    desc: {
      en: "Distinct people opening PRs; higher can mean more distributed contribution.",
      ko: "PR을 연 서로 다른 사람 수, 분산된 기여를 나타냅니다.",
    },
  },
  "G4.5": {
    short: { en: "Median time to merge", ko: "머지 소요(중앙)" },
    desc: {
      en: "Median calendar days to merge; lower is faster review (capped in scoring).",
      ko: "PR 머지까지 걸린 일수의 중앙값. 짧을수록 리뷰/머지가 빠릅니다.",
    },
  },
  // G5 release
  "G5.1": {
    short: { en: "Releases in period", ko: "릴리스 횟수" },
    desc: {
      en: "Number of published releases in the time window.",
      ko: "해당 기간에 공개된 릴리스 횟수입니다.",
    },
  },
  "G5.2": {
    short: { en: "Release cadence", ko: "릴리스 간격" },
    desc: {
      en: "Average days between consecutive releases in the period; regular shipping.",
      ko: "연속 릴리스 사이의 평균 일수. 꾸준한 배포 리듬을 나타냅니다.",
    },
  },
  "G5.3": {
    short: { en: "Release downloads", ko: "릴리스 다운로드" },
    desc: {
      en: "Sum of release asset download counts in the period.",
      ko: "릴리스 자산(assets)의 다운로드 수 합계입니다.",
    },
  },
  "G5.4": {
    short: { en: "Tag count", ko: "태그 수" },
    desc: {
      en: "Number of version tags; optional signal of versioning discipline (may be zero-weighted).",
      ko: "버전 태그 개수(스코어 가중 0인 경우가 있을 수 있음)입니다.",
    },
  },
  npm_downloads: {
    short: { en: "npm downloads", ko: "npm 다운로드" },
    desc: {
      en: "npm downloads in the registry’s last-month window when a package name is found in the repository’s package.json.",
      ko: "저장소의 package.json에서 패키지명을 확인할 수 있을 때 조회한 npm 최근 1개월 다운로드 수입니다.",
    },
  },
  pypi_downloads: {
    short: { en: "PyPI downloads", ko: "PyPI 다운로드" },
    desc: {
      en: "PyPI downloads in the last-month window when the project metadata points back to this GitHub repository.",
      ko: "PyPI 프로젝트 메타데이터가 이 GitHub 저장소를 가리킬 때 조회한 최근 1개월 다운로드 수입니다.",
    },
  },
  "G6.1": {
    short: { en: "Dependents", ko: "의존(사용) 수" },
    desc: {
      en: "How many public repos on GitHub depend on this package (from dependents graph, best-effort).",
      ko: "이 패키지에 의존하는 GitHub 공개 저장소 수입니다(의존성 그래프, 가능한 범위).",
    },
  },
  "G7.1": {
    short: { en: "Community health %", ko: "커뮤니티 건강도" },
    desc: {
      en: "GitHub’s community health score (0–100) if available.",
      ko: "GitHub 커뮤니티 프로필이 보고하는 0~100 건강도 점수입니다.",
    },
  },
  "G7.2": {
    short: { en: "Has CONTRIBUTING", ko: "CONTRIBUTING" },
    desc: {
      en: "Whether a CONTRIBUTING file is present (1) or not (0).",
      ko: "CONTRIBUTING 문서가 있는지(1/0)입니다.",
    },
  },
  "G7.3": {
    short: { en: "Code of conduct", ko: "행동 강령" },
    desc: {
      en: "Whether a code of conduct file is present.",
      ko: "행동 강령 문서가 있는지(1/0)입니다.",
    },
  },
  "G7.4": {
    short: { en: "README", ko: "README" },
    desc: {
      en: "Whether README is detected in community health files.",
      ko: "커뮤니티 프로필에 README가 있는지(1/0)입니다.",
    },
  },
  "G8.1": {
    short: { en: "Quality-adjusted stars", ko: "품질 보정 별점" },
    desc: {
      en: "Total stars multiplied by the average account-quality score of up to 100 recent visible stargazers. This is a heuristic, not a fraud verdict.",
      ko: "전체 별점 수에 조회 가능한 최근 스타게이저 최대 100명의 평균 계정 품질 점수를 곱한 휴리스틱입니다. 부정행위 판정값은 아닙니다.",
    },
  },
  "G8.2": {
    short: { en: "Recent star velocity", ko: "최근 별점 유입속도" },
    desc: {
      en: "Average stars per day across the most recent visible stargazer sample. A high value means stars arrived quickly, not necessarily suspiciously.",
      ko: "조회 가능한 최근 스타게이저 표본 구간의 하루 평균 별점 수입니다. 높으면 빠른 유입을 뜻하지만 그 자체로 이상 징후는 아닙니다.",
    },
  },
  "G8.3": {
    short: { en: "Burst flag", ko: "급증 플래그" },
    desc: {
      en: "Heuristic 0/1 when a star-activity burst was detected.",
      ko: "별점 급증이 감지되면 1, 아니면 0입니다.",
    },
  },
  // Social
  story_count: {
    short: { en: "HN stories", ko: "HN 스토리" },
    desc: {
      en: "Number of Hacker News stories (via Algolia) that mention the repo in the period.",
      ko: "기간·쿼리에 맞는 HN 스토리 수(검색 기반)입니다.",
    },
  },
  total_points: {
    short: { en: "HN points", ko: "HN 점수 합" },
    desc: {
      en: "Sum of points on matching HN stories.",
      ko: "해당 HN 스토리들의 총 포인트입니다.",
    },
  },
  total_comments: {
    short: { en: "HN comments", ko: "HN 댓글 합" },
    desc: {
      en: "Total comments on matching HN stories.",
      ko: "해당 스토리에 달린 댓글 수의 합입니다.",
    },
  },
  engagement: {
    short: { en: "HN engagement", ko: "HN 반응" },
    desc: {
      en: "Weighted HN interest score from points and comments in the model.",
      ko: "포인트·댓글을 섞은 HN 상호작용 지표입니다.",
    },
  },
  top_story: {
    short: { en: "Top HN item", ko: "최다 점수 스토리" },
    desc: {
      en: "Highest-point matching story; metadata only in some views.",
      ko: "가장 점수가 높은 스토리(일부 뷰에서만 메타로 표시)입니다.",
    },
  },
  reddit_post_count: {
    short: { en: "Reddit posts", ko: "Reddit 게시글" },
    desc: {
      en: "Matching Reddit posts found in the selected period; N/A means the source was unavailable.",
      ko: "선택 기간에 찾은 관련 Reddit 게시글 수입니다. N/A는 데이터 소스를 사용할 수 없었다는 뜻입니다.",
    },
  },
  reddit_score_sum: {
    short: { en: "Reddit score", ko: "Reddit 점수 합" },
    desc: {
      en: "Sum of Reddit scores on matching posts in the selected period.",
      ko: "선택 기간의 관련 Reddit 게시글 점수를 합한 값입니다.",
    },
  },
  reddit_comment_sum: {
    short: { en: "Reddit comments", ko: "Reddit 댓글 합" },
    desc: {
      en: "Total comments on matching Reddit posts in the selected period.",
      ko: "선택 기간의 관련 Reddit 게시글에 달린 댓글 수 합계입니다.",
    },
  },
  so_question_count: {
    short: { en: "Stack Overflow questions", ko: "Stack Overflow 질문" },
    desc: {
      en: "Stack Overflow questions matching the repository in the selected period.",
      ko: "선택 기간에 저장소와 관련된 Stack Overflow 질문 수입니다.",
    },
  },
  so_answered_ratio: {
    short: { en: "Stack Overflow answer rate", ko: "Stack Overflow 답변율" },
    desc: {
      en: "Share of matching Stack Overflow questions marked as answered, from 0 to 1.",
      ko: "관련 Stack Overflow 질문 중 답변 완료로 표시된 비율(0~1)입니다.",
    },
  },
  so_score_sum: {
    short: { en: "Stack Overflow score", ko: "Stack Overflow 점수 합" },
    desc: {
      en: "Sum of scores on matching Stack Overflow questions.",
      ko: "관련 Stack Overflow 질문 점수의 합계입니다.",
    },
  },
  youtube_video_count: {
    short: { en: "YouTube videos", ko: "YouTube 영상" },
    desc: {
      en: "YouTube videos matching the repository in the selected period.",
      ko: "선택 기간에 저장소와 관련된 YouTube 영상 수입니다.",
    },
  },
  youtube_view_sum: {
    short: { en: "YouTube views", ko: "YouTube 조회수" },
    desc: {
      en: "Total views on matching YouTube videos.",
      ko: "관련 YouTube 영상의 전체 조회수 합계입니다.",
    },
  },
  youtube_like_sum: {
    short: { en: "YouTube likes", ko: "YouTube 좋아요" },
    desc: {
      en: "Total likes on matching YouTube videos.",
      ko: "관련 YouTube 영상의 좋아요 수 합계입니다.",
    },
  },
  // Hugging Face
  likes: {
    short: { en: "Likes", ko: "좋아요" },
    desc: {
      en: "Model/dataset like count on Hugging Face.",
      ko: "Hugging Face 모델/데이터셋 좋아요 수입니다.",
    },
  },
  downloads: {
    short: { en: "Recent downloads", ko: "최근 다운로드" },
    desc: {
      en: "Recent HF Hub download stat. HF counts server-side GET/HEAD requests to selected query files, so this is usage traffic, not unique users.",
      ko: "HF Hub의 최근 다운로드 통계입니다. 서버가 지정 query 파일에 대한 GET/HEAD 요청을 집계하므로 고유 사용자 수가 아니라 사용 트래픽 신호입니다.",
    },
  },
  downloadsAllTime: {
    short: { en: "All-time downloads", ko: "누적 다운로드" },
    desc: {
      en: "Cumulative HF Hub download stat. It is treated as a stock adoption signal and discounted by the recency factor.",
      ko: "HF Hub의 누적 다운로드 통계입니다. 누적 채택 신호로 보며 recency factor로 하향 보정합니다.",
    },
  },
  trendingScore: {
    short: { en: "Trending score", ko: "트렌딩" },
    desc: {
      en: "HF trending signal when available.",
      ko: "가능한 경우 HF의 트렌딩 점수입니다.",
    },
  },
  spaces_count: {
    short: { en: "HF Spaces", ko: "스페이스 수" },
    desc: {
      en: "Number of Hugging Face Spaces that use this model/repo.",
      ko: "이 모델·리소스를 쓰는 Space 개수입니다.",
    },
  },
  inference: {
    short: { en: "Inference uses", ko: "추론 사용" },
    desc: {
      en: "Inference-related count from card metadata (when exposed).",
      ko: "카드 메타에 노출될 때의 추론 관련 횟수입니다.",
    },
  },
  inferenceProviderCount: {
    short: { en: "Inf. providers", ko: "추론 공급자" },
    desc: {
      en: "How many third-party providers expose inference for the model (when available).",
      ko: "추론을 노출한 외부 공급자 수(가능한 경우)입니다.",
    },
  },
  derived_models_count: {
    short: { en: "Derived models", ko: "파생 모델 수" },
    desc: {
      en: "Models on Hugging Face that declare this model as their base model.",
      ko: "이 모델을 기반 모델로 명시한 Hugging Face 파생 모델 수입니다.",
    },
  },
  commit_count: {
    short: { en: "HF commits", ko: "HF 커밋" },
    desc: {
      en: "Commit activity in the period on the HF repository.",
      ko: "HF 쪽 저장소의 기간 중 커밋 수입니다.",
    },
  },
  unique_contributors: {
    short: { en: "HF contributors", ko: "기여자 수" },
    desc: {
      en: "Unique contributors in the period on the HF side.",
      ko: "기간 중 HF 쪽 고유 기여자 수입니다.",
    },
  },
  days_since_last_commit: {
    short: { en: "Days since commit", ko: "최근 커밋 경과" },
    desc: {
      en: "Calendar days since the last commit; lower is more active (scored with inverse in config).",
      ko: "마지막 커밋 이후 경과일. 짧을수록 활발(스코어는 역가중)입니다.",
    },
  },
  discussion_count: {
    short: { en: "Discussions", ko: "토론 수" },
    desc: {
      en: "Count of community discussions on Hugging Face.",
      ko: "Hugging Face 커뮤니티 토론 수입니다.",
    },
  },
  pr_count: {
    short: { en: "HF PRs", ko: "PR 수" },
    desc: {
      en: "Pull requests in the period on the HF side.",
      ko: "HF 쪽 풀 리퀘스트 수입니다.",
    },
  },
  card_score: {
    short: { en: "Model card quality", ko: "카드 품질" },
    desc: {
      en: "Model card / metadata completeness or quality score from HF (0–1).",
      ko: "모델 카드·메타데이터 완성도 점수(0~1)입니다.",
    },
  },
  library_name: {
    short: { en: "Library tag", ko: "라이브러리" },
    desc: {
      en: "Associated library name from the card, if present (auxiliary).",
      ko: "카드에 붙는 라이브러리/태그(보조 정보)입니다.",
    },
  },
  discussions_count: {
    short: { en: "GitHub discussions", ko: "GitHub 토론 수" },
    desc: {
      en: "Current number of GitHub Discussions in the repository.",
      ko: "저장소에 있는 현재 GitHub Discussions 수입니다.",
    },
  },
  has_discussions_enabled: {
    short: { en: "Discussions enabled", ko: "토론 기능 사용" },
    desc: {
      en: "Whether GitHub Discussions is enabled: 1 means enabled and 0 means disabled.",
      ko: "GitHub Discussions 기능 사용 여부입니다. 1은 사용, 0은 사용 안 함입니다.",
    },
  },
  license_spdx: {
    short: { en: "License", ko: "라이선스" },
    desc: {
      en: "License metadata detected by GitHub, including the SPDX identifier when available.",
      ko: "GitHub이 감지한 라이선스 정보이며, 가능한 경우 SPDX 식별자를 포함합니다.",
    },
  },
  contributor_insights: {
    short: { en: "Contributor flow summary", ko: "기여자 흐름 요약" },
    desc: {
      en: "Aggregated monthly contributor activity based on a 24-month observation window; expand the supporting JSON for monthly details and limits.",
      ko: "최근 24개월 관측 구간을 바탕으로 집계한 월별 기여자 활동입니다. 월별 상세값과 한계는 근거 JSON에서 확인할 수 있습니다.",
    },
  },
};

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/G(\d)\.(\d)/, "G$1.$2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getMetricLabel(key: string, locale: Locale): string {
  const m = METRIC_COPY[key];
  if (m) return locale === "ko" ? m.short.ko : m.short.en;
  return humanizeKey(key);
}

export function getMetricDescription(key: string, locale: Locale): string {
  const m = METRIC_COPY[key];
  if (m) return locale === "ko" ? m.desc.ko : m.desc.en;
  return locale === "ko" ? "지표 값입니다." : "Metric value in the score model.";
}
