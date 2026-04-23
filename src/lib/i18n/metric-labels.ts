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
    short: { en: "Star count", ko: "스타 수" },
    desc: {
      en: "Total GitHub stars; measures broad recognition of the repository.",
      ko: "GitHub 스타 총개수. 리포지토리에 대한 광범위한 인지도를 나타냅니다.",
    },
  },
  forks: {
    short: { en: "Fork count", ko: "포크 수" },
    desc: {
      en: "Number of repository forks, indicating reuse and experimentation.",
      ko: "포크 수. 코드 재사용·실험의 관심을 나타냅니다.",
    },
  },
  watchers: {
    short: { en: "Watchers", ko: "Watcher 수" },
    desc: {
      en: "Users watching the repo for activity notifications.",
      ko: "활동 알림을 구독하는 사용자 수입니다.",
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
      en: "Distinct contributors with commits in the period.",
      ko: "해당 기간에 커밋이 있는 서로 다른 기여자 수입니다.",
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
      ko: "최근 4주 대비 이전 4주 커밋 비율. 1보다 크면 가속, 작으면 둔화로 해석됩니다.",
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
  "G6.1": {
    short: { en: "Dependents", ko: "의존(사용) 수" },
    desc: {
      en: "How many public repos on GitHub depend on this package (from dependents graph, best-effort).",
      ko: "GitHub에 공개된 의존 리포지토리 수(의존성 그래프, 가능한 범위에서)입니다.",
    },
  },
  "G7.1": {
    short: { en: "Community health %", ko: "커뮤니티 건강도" },
    desc: {
      en: "GitHub’s community health score (0–100) if available.",
      ko: "GitHub 커뮤니티 프로필의 건강도 점수(0~100)입니다.",
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
    short: { en: "Sampled stargazer mass", ko: "스타 샘플 규모" },
    desc: {
      en: "Scale of sampled recent stargazers used for quality scoring.",
      ko: "스타 품질 산정에 쓰인 샘플 스타게이저 규모입니다.",
    },
  },
  "G8.2": {
    short: { en: "Account-age balance", ko: "계정 연령 균형" },
    desc: {
      en: "Balance between new vs established accounts among stargazers; flags botted bursts.",
      ko: "스타를 준 계정의 신규/기존 비율. 봇·급작스러운 집계를 잡는 데 쓰입니다.",
    },
  },
  "G8.3": {
    short: { en: "Burst flag", ko: "급증 플래그" },
    desc: {
      en: "Heuristic 0/1 when a star-activity burst was detected.",
      ko: "스타 급증이 감지되면 1, 아니면 0입니다.",
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
      en: "Download count in a recent window from HF stats (when available).",
      ko: "HF에서 제공하는 최근 기간 다운로드 수입니다.",
    },
  },
  downloadsAllTime: {
    short: { en: "All-time downloads", ko: "누적 다운로드" },
    desc: {
      en: "Cumulative download count (model card / API).",
      ko: "누적 다운로드 수(카드·API)입니다.",
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
