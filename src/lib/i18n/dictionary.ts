export type Locale = "en" | "ko";

const en = {
  meta: {
    title: "RepoPopIndex — Measure Real Repository Popularity",
    description:
      "Quantify how actively GitHub repos and HuggingFace models are used. 50+ metrics, anti-abuse star quality weighting, composite 0-100 score.",
  },
  home: {
    title: "RepoPopIndex",
    subtitle:
      "Measures how actively a repository is being used. 50+ metrics with GitHub star abuse correction.",
    urlPlaceholder: "github.com/facebook/react or huggingface.co/meta-llama/Llama-3",
    period: "Period:",
    analyze: "Analyze Repository",
    analyzing: "Analyzing...",
    footnote: "Supports GitHub repositories and HuggingFace models/datasets. Analysis takes 15-30 seconds.",
    errUrlEmpty: "Please enter a repository URL",
    errNetwork: "Network error. Please try again.",
    err503: "The service is busy. Please try again in a few minutes.",
    errAnalysis: "Analysis could not be started. Please try again.",
  },
  common: {
    loading: "Preparing...",
  },
  report: {
    failTitle: "Analysis Failed",
    tryAnother: "Try another repository",
    analyzingTitle: "Analyzing repository...",
    queuePosition: "Queue position: #{n}",
    estimatedWait: "— ~{n}s",
    partialBanner:
      "Some data sources were unavailable — score is based on available data only.",
    categoryOverview: "Category overview",
    categoryBreakdown: "Category breakdown",
    contributorFlow: "Contributor flow & response",
    performanceHistory: "Monthly measurement history",
    starQuality: "Star quality analysis",
    socialBuzz: "Social buzz",
    detailedMetrics: "Detailed metrics",
    rawData: "Collected GitHub data",
    footerFormula:
      "Score formula: S_i = log(1 + raw) / log(1 + max). Categories are weighted and averaged. Missing data is excluded proportionally.",
    analyzed: "Analyzed",
    period: "Period",
    notFound: "Analysis not found",
    loadFailed: "Failed to load report",
    notReady: "Report not ready",
    partialResult: "Partial result",
    partialMissing: "affected source or limit",
    lastViewBanner: "Showing your last view of this report — refreshing…",
    periods: {
      "1w": "1 week",
      "1m": "1 month",
      "3m": "3 months",
      "6m": "6 months",
      "1y": "1 year",
    },
  },
  contributors: {
    eyebrow: "12-month measurement ledger",
    title: "Contributor flow",
    subtitle:
      "Monthly activity, observed newcomer entry, repeat participation, and repository-affiliation signals.",
    exportCsv: "Download CSV",
    active: "Active contributors",
    activeHelp: "Unique people with at least one commit, pull request, or issue in the displayed 12 months.",
    observedNew: "Observed new",
    observedNewHelp: "People first seen inside the 24-month observation window; not a lifetime newcomer count.",
    firstTimeSignals: "GitHub first-time signals",
    firstTimeSignalsHelp: "GitHub FIRST_TIMER or FIRST_TIME_CONTRIBUTOR associations, shown as supporting evidence only.",
    retention: "Last complete month retention",
    retentionHelp: "Share of the previous month’s active people who were also active in the latest completed month.",
    affiliated: "Repository-affiliated",
    external: "Other public contributors",
    unknown: "Unknown association",
    verifiedTitle: "Administrator-verified employment",
    verifiedInternal: "Checked internal",
    verifiedOther: "Not checked as internal",
    verifiedHelp:
      "This uses the administrator-maintained GitHub ID roster. It is separate from GitHub repository affiliation and may become stale between roster reviews.",
    responseTitle: "Response discipline",
    humanMedian: "First human response",
    maintainerMedian: "Repository-affiliated response",
    responseCoverage: "Human response coverage",
    maintainerCoverage: "Affiliated response coverage",
    unanswered: "unanswered",
    sample: "issues sampled",
    noData: "Contributor-flow data is unavailable for this report.",
    partialData: "Partial API sample",
    completeData: "Complete within collection cap",
    methodology:
      "Observed new means first seen within the 24-month API window. Affiliated combines owner, organization member, and collaborator; it does not prove employment.",
    responseMethodology:
      "Response medians use the latest 30 issues. Comments by the issue author and bots are excluded; unanswered issues remain visible in coverage.",
    responsePartial:
      "At least one sampled issue had more than 20 comments. A valid first response after the first 20 comments may be missed.",
    month: "Month",
    activity: "Activity",
    contributors: "Contributors",
    new: "Observed new",
    returning: "Returning",
    retentionShort: "Retention",
    association: "Affiliation",
    partialMonth: "in progress",
    commits: "commits",
    pullRequests: "PRs",
    issues: "issues",
  },
  snapshots: {
    eyebrow: "Monthly snapshots without automatic expiry",
    title: "Measurement history",
    subtitle:
      "The latest complete or partial analysis in each calendar month is stored without automatic expiry.",
    methodology:
      "Baseline is the earliest saved month, latest is the most recent saved month, and change is the difference in composite score points. Re-running within the same month replaces that month’s snapshot. No-expiry storage is not a backup guarantee.",
    exportCsv: "Download history CSV",
    month: "Month",
    composite: "Composite",
    contributors: "Active contributors",
    newContributors: "Observed new",
    retention: "Retention",
    response: "Human response",
    quality: "Data quality",
    complete: "Complete",
    partial: "Partial",
    unknown: "Unknown",
    missing: "Missing",
    baseline: "Baseline",
    latest: "Latest",
    change: "Change",
  },
  rawData: {
    eyebrow: "Traceable collection evidence",
    title: "Collected GitHub data",
    subtitle:
      "These are the collected or derived values before score normalization, with supporting metadata extracted from GitHub responses. Request headers, access tokens, and oversized full HTTP bodies are never stored.",
    exportJson: "Download JSON",
    exportNote:
      "Collected or derived pre-normalization values from GitHub API responses; this is not a byte-for-byte archive of full HTTP response bodies.",
    readingTitle: "How to read this section",
    readingGuide:
      "Raw value is the value before scoring. Expand JSON details to inspect supporting metadata. N/A means collection failed or GitHub did not provide a usable value; it is not treated as zero.",
    collectedAt: "Collected",
    items: "items",
    rawValue: "raw value",
    rawJson: "Show supporting JSON",
    openGitHub: "Open on GitHub",
    error: "Collection warning",
    unknownSource: "Calculation inputs collected from an external source.",
    status: {
      complete: "collected",
      partial: "partial",
      failed: "failed",
    },
  },
  scoreGauge: {
    index: "Popularity index",
    h80: "Highly active",
    h60: "Active",
    h40: "Moderate",
    h20: "Low activity",
    h0: "Minimal activity",
  },
  categoryCards: {
    none: "No categories available.",
    insufficient: "Insufficient data",
  },
  categoryRadar: {
    none: "No category data available.",
    seriesName: "Score",
  },
  metricsTable: {
    none: "No metrics available.",
    insufficient: "Insufficient data",
    metric: "Metric",
    raw: "Raw",
    normalized: "Normalized",
    weight: "Weight",
    contribution: "Contribution",
    openSource: "Open the source data on the provider",
    guideTitle: "How the score table works",
    guideRaw:
      "Raw is the value collected from the provider before scoring. N/A means unavailable, not zero.",
    guideNormalized:
      "Normalized converts different units to a comparable 0–1 scale. Some lower-is-better metrics are reversed.",
    guideWeight:
      "Weight expresses the relative importance of a metric within its category.",
    guideContribution:
      "Contribution is the normalized value after recency adjustment, multiplied by its weight.",
  },
  starQuality: {
    title: "Star quality assessment",
    burst: "Star burst detected — unusual spike in starring activity.",
    factor: "Quality factor",
    recentUqs: "Recent UQS",
    historicalUqs: "Historical UQS",
    footnote:
      "UQS (User Quality Score) estimates how authentic stargazers look. Computed from the 100 most recent stargazers using account age, follower count, and public-repo count.",
  },
  social: {
    hnTitle: "Hacker News",
    stories: "Stories",
    points: "Total points",
    comments: "Comments",
    topStory: "Top story",
    pts: "pts",
    noMentions:
      "No Hacker News mentions for this repository in the selected period.",
    redditTitle: "Reddit",
    redditPosts: "Posts",
    redditScore: "Score",
    redditComments: "Comments",
    noRedditMentions:
      "No Reddit posts about this repository in the selected period.",
    soTitle: "Stack Overflow",
    soQuestions: "Questions",
    soAnsweredRatio: "Answer rate",
    soScore: "Score",
    noSoMentions:
      "No Stack Overflow questions about this repository in the selected period.",
    soViews: "Views",
    youtubeTitle: "YouTube",
    youtubeVideos: "Videos",
    youtubeViews: "Total views",
    youtubeLikes: "Likes",
    noYoutubeMentions:
      "No YouTube videos about this repository in the selected period.",
  },
  language: {
    en: "English",
    ko: "한국어",
    label: "Language",
  },
  nav: {
    home: "RepoPopIndex",
    methodology: "Methodology",
    about: "About",
  },
  recentReports: {
    title: "Recent Reports",
    emptyState: "No reports yet. Analyze a repository to get started.",
    viewReport: "View report",
    score: "Score",
  },
  methodology: {
    title: "How We Score",
    intro:
      "RepoPopIndex computes a composite 0–100 popularity score from 50+ signals across GitHub, HuggingFace, Hacker News, Reddit, Stack Overflow, and YouTube. Each signal is log-normalized, weighted, and combined into a final score that reflects real-world adoption — not surface-level star counts.",
    categoriesTitle: "Score categories & weights",
    categoriesBody:
      "GitHub repositories are scored across six categories: Activity (20%), Community (20%), Adoption (25%), Popularity (15%), Health (5%), and Social Buzz (15%). HuggingFace models/datasets use Downloads (25%), Integration (20%), Activity (20%), Community (10%), Popularity (10%), and Social Buzz (15%). Category scores are averaged proportionally — if a category has insufficient data, its weight is redistributed across the remaining categories.",
    socialBuzzTitle: "Social Buzz sub-sources (S1)",
    socialBuzzBody:
      "The Social Buzz category aggregates up to four sources: Hacker News, Reddit, Stack Overflow, and YouTube. Sub-source weights (HN 48%, Reddit 30%, SO 12%, YT 9%) are calibrated from empirical data across 25 major OSS repos — Reddit is typically unavailable (credentials not configured), and SO/YouTube yield at most 1 item per 3-month window. In practice, Hacker News is the dominant signal (~70% of the ceiling when Reddit is absent). Missing sources (null) are excluded from both numerator and denominator; zero-value sources remain in the denominator with their reduced weight.",
    starAbuseTitle: "Star quality & abuse correction",
    starAbuseBody:
      "A separate quality-adjusted star signal is computed from up to 100 recent visible stargazers. Each sampled account is evaluated on age, follower count, and public repository count. The resulting UQS factor (0–1) is multiplied by the total star count to produce G8.1, while the raw star count remains a separate metric. An unusual arrival spike records a review flag; it does not automatically reduce the factor further.",
    formulaTitle: "Composite score formula",
    formulaBody:
      "Each metric is normalized as: S_i = log(1 + raw) / log(1 + max), where max is a calibrated ceiling for top-tier values. Cumulative (all-time) metrics are multiplied by a recency factor of 0.75 to discount stock signals vs. flow signals. Metrics within a category are weight-averaged into a category score (0–100). Category scores are then weight-averaged into the final composite score.",
    partialTitle: "Partial results",
    partialBody:
      "When a core source fails, a category lacks enough data, or an optional source is rate-limited, the report shows a partial-data warning. Missing metric and category weights are excluded from the available denominator. Cached fallback is available only for Reddit, Stack Overflow, and YouTube when a recent successful collection exists.",
  },
  about: {
    title: "About RepoPopIndex",
    intro:
      "RepoPopIndex is an open-source project that quantifies how actively an open-source repository is actually being used — not how popular it looks at a glance. The goal is to surface signals that survive star-farming, hype cycles, and abandonment, so contributors and adopters can make informed decisions.",
    missionTitle: "Why this exists",
    missionBody:
      "Star counts are easy to inflate and slow to decay. They reward attention, not adoption. We score across activity, community, downstream integration, release cadence, social discussion, and project health so a repository's real footprint shows through. A polished but inactive project should not look identical to one that ships every week.",
    dataSourcesTitle: "Data sources",
    dataSourcesBody:
      "GitHub REST and GraphQL APIs, the HuggingFace Hub API, Hacker News (Algolia), Reddit, Stack Exchange (Stack Overflow), and YouTube Data API. Signals are collected on demand and cached in Upstash Redis; monthly snapshots are stored without automatic expiry. There is no relational database. Because upstream data can change or disappear, a later re-run is not guaranteed to reproduce an earlier snapshot exactly.",
    openSourceTitle: "Open source",
    openSourceBody:
      "The code is MIT licensed and lives on GitHub. Issues, PRs, and discussions about scoring, weights, or new signal sources are welcome. The methodology page documents how the score is computed today.",
    contactTitle: "Repository",
    contactBody: "github.com/9bow/RepoPopIndex",
  },
};

const ko: typeof en = {
  meta: {
    title: "RepoPopIndex — 저장소의 실제 활용도 측정",
    description:
      "GitHub 저장소와 Hugging Face 모델·데이터셋이 얼마나 활발히 쓰이는지 50개 이상의 지표와 별점 어뷰징 보정을 거쳐 0~100점으로 산출합니다.",
  },
  home: {
    title: "RepoPopIndex",
    subtitle:
      "해당 저장소가 얼마나 활발하게 활동하는지 측정합니다. 50개 이상의 지표와 GitHub Star 어뷰징 보정 포함.",
    urlPlaceholder: "github.com/facebook/react 또는 huggingface.co/meta-llama/Llama-3",
    period: "기간:",
    analyze: "저장소 분석",
    analyzing: "분석 중...",
    footnote: "GitHub 저장소와 Hugging Face 모델·데이터셋을 분석합니다. 약 15~30초 소요됩니다.",
    errUrlEmpty: "저장소 URL을 입력해 주세요.",
    errNetwork: "네트워크 오류입니다. 다시 시도해 주세요.",
    err503: "서비스가 혼잡합니다. 잠시 후 다시 시도해 주세요.",
    errAnalysis: "분석을 시작할 수 없습니다. 다시 시도해 주세요.",
  },
  common: {
    loading: "준비 중...",
  },
  report: {
    failTitle: "분석 실패",
    tryAnother: "다른 저장소 분석하기",
    analyzingTitle: "저장소를 분석하는 중...",
    queuePosition: "대기열 #{n}번째",
    estimatedWait: "— 약 {n}초",
    partialBanner: "일부 데이터를 가져오지 못했습니다. 수집된 데이터만으로 점수를 계산했습니다.",
    categoryOverview: "분야별 개요",
    categoryBreakdown: "분야별 세부 점수",
    contributorFlow: "기여자 흐름 및 응답성",
    performanceHistory: "월별 측정 이력",
    starQuality: "별점 품질 분석",
    socialBuzz: "커뮤니티 반응",
    detailedMetrics: "상세 지표",
    rawData: "GitHub 수집 데이터",
    footerFormula:
      "점수 식: S_i = log(1 + raw) / log(1 + max). 카테고리별 가중 평균이며, 누락된 데이터는 비례해 제외합니다.",
    analyzed: "분석 일시",
    period: "기간",
    notFound: "분석 결과를 찾을 수 없습니다.",
    loadFailed: "리포트를 불러오지 못했습니다.",
    notReady: "리포트가 아직 준비되지 않았습니다.",
    partialResult: "일부 결과",
    partialMissing: "영향받은 소스·제한",
    lastViewBanner: "마지막으로 저장된 보고서를 표시 중입니다 — 갱신 중…",
    periods: {
      "1w": "1주",
      "1m": "1개월",
      "3m": "3개월",
      "6m": "6개월",
      "1y": "1년",
    },
  },
  contributors: {
    eyebrow: "최근 12개월 측정 원장",
    title: "기여자 흐름",
    subtitle:
      "월별 활동, 관측 신규 유입, 재참여율과 저장소 연관 신호를 함께 표시합니다.",
    exportCsv: "CSV 다운로드",
    active: "활동 기여자",
    activeHelp: "표시된 최근 12개월 동안 커밋·PR·이슈 중 하나 이상에 참여한 고유 계정 수입니다.",
    observedNew: "관측 신규",
    observedNewHelp: "최근 24개월 관측 구간 안에서 처음 확인된 계정 수이며, 저장소 전체 역사 기준 신규는 아닙니다.",
    firstTimeSignals: "GitHub 최초 기여 신호",
    firstTimeSignalsHelp: "GitHub의 FIRST_TIMER 또는 FIRST_TIME_CONTRIBUTOR 연관 신호이며, 보조 근거로만 표시합니다.",
    retention: "최근 완료 월 재참여율",
    retentionHelp: "직전 달 활동자 중 최근 완료 월에도 다시 활동한 계정의 비율입니다.",
    affiliated: "저장소 연관",
    external: "기타 공개 기여자",
    unknown: "연관 분류 불가",
    verifiedTitle: "관리자 확인 고용 구분",
    verifiedInternal: "내부 직원 확인",
    verifiedOther: "내부 미확인",
    verifiedHelp:
      "관리자가 관리 페이지에서 GitHub ID별로 확인한 명부입니다. GitHub 저장소 연관 신호와 별개이며, 명부 검토 사이에는 변경이 반영되지 않을 수 있습니다.",
    responseTitle: "응답 운영",
    humanMedian: "첫 사람 응답",
    maintainerMedian: "저장소 연관 계정 응답",
    responseCoverage: "사람 응답률",
    maintainerCoverage: "연관 계정 응답률",
    unanswered: "미응답",
    sample: "개 이슈 표본",
    noData: "이 리포트에는 기여자 흐름 데이터가 없습니다.",
    partialData: "API 일부 표본",
    completeData: "수집 상한 내 전체",
    methodology:
      "관측 신규는 최근 24개월 API 범위에서 처음 나타난 계정입니다. 저장소 연관은 소유자·조직원·협업자를 합친 값이며 고용 관계를 의미하지 않습니다.",
    responseMethodology:
      "응답 중앙값은 최신 이슈 30개 표본을 사용합니다. 이슈 작성자 본인과 봇 댓글은 제외하며, 미응답 이슈는 응답률에 남겨 둡니다.",
    responsePartial:
      "표본 이슈 중 하나 이상이 댓글 20개를 초과했습니다. 20번째 댓글 뒤의 유효한 첫 응답은 누락될 수 있습니다.",
    month: "월",
    activity: "활동",
    contributors: "기여자",
    new: "관측 신규",
    returning: "재참여",
    retentionShort: "유지율",
    association: "연관 구분",
    partialMonth: "집계 중",
    commits: "커밋",
    pullRequests: "PR",
    issues: "이슈",
  },
  snapshots: {
    eyebrow: "자동 만료 없는 월별 스냅샷",
    title: "측정 이력",
    subtitle:
      "달력 월마다 가장 최근의 완전 또는 일부 분석값을 자동 만료 없이 저장합니다.",
    methodology:
      "기준선은 저장된 첫 달, 최근은 마지막 달, 변화는 두 종합 점수의 차이입니다. 같은 달에 다시 분석하면 그 달의 스냅샷을 최신 실행값으로 갱신합니다. 자동 만료가 없다는 것이 별도 백업을 보장하지는 않습니다.",
    exportCsv: "이력 CSV 다운로드",
    month: "월",
    composite: "종합 점수",
    contributors: "활동 기여자",
    newContributors: "관측 신규",
    retention: "재참여율",
    response: "사람 응답",
    quality: "데이터 품질",
    complete: "완전 수집",
    partial: "일부 수집",
    unknown: "상태 미기록",
    missing: "누락",
    baseline: "기준선",
    latest: "최근",
    change: "변화",
  },
  rawData: {
    eyebrow: "추적 가능한 수집 근거",
    title: "GitHub 수집 데이터",
    subtitle:
      "GitHub 응답에서 추출한 수집값 또는 점수 정규화 전 파생값과 근거 메타데이터입니다. 요청 헤더·접근 토큰과 용량이 큰 전체 HTTP 응답 본문은 저장하지 않습니다.",
    exportJson: "JSON 다운로드",
    exportNote:
      "GitHub API 응답에서 추출한 수집값 또는 정규화 전 파생값이며, 전체 HTTP 응답 본문을 바이트 단위로 보존한 자료는 아닙니다.",
    readingTitle: "읽는 방법",
    readingGuide:
      "원시값은 점수로 바꾸기 전 값입니다. JSON 세부 정보를 펼치면 계산 근거 메타데이터를 볼 수 있습니다. N/A는 수집 실패 또는 사용 가능한 값이 없다는 뜻이며 0으로 계산하지 않습니다.",
    collectedAt: "수집 시각",
    items: "개 항목",
    rawValue: "원시값",
    rawJson: "근거 JSON 보기",
    openGitHub: "GitHub에서 확인",
    error: "수집 경고",
    unknownSource: "외부 제공처에서 수집한 계산 입력값입니다.",
    status: {
      complete: "수집 완료",
      partial: "일부 수집",
      failed: "수집 실패",
    },
  },
  scoreGauge: {
    index: "활용도 지수",
    h80: "매우 활발함",
    h60: "활발함",
    h40: "보통",
    h20: "저조함",
    h0: "매우 저조함",
  },
  categoryCards: {
    none: "표시할 분야가 없습니다.",
    insufficient: "데이터 부족",
  },
  categoryRadar: {
    none: "분야 데이터가 없습니다.",
    seriesName: "점수",
  },
  metricsTable: {
    none: "지표가 없습니다.",
    insufficient: "데이터 부족",
    metric: "지표",
    raw: "원시값",
    normalized: "정규값",
    weight: "가중치",
    contribution: "기여도",
    openSource: "원본 데이터를 제공처에서 열기",
    guideTitle: "점수표 읽는 방법",
    guideRaw:
      "원시값은 제공처에서 수집한 점수 계산 전 값입니다. N/A는 0이 아니라 수집할 수 없었다는 뜻입니다.",
    guideNormalized:
      "정규값은 단위가 다른 지표를 비교할 수 있도록 0~1로 바꾼 값입니다. 짧을수록 좋은 지표는 방향을 반대로 계산합니다.",
    guideWeight:
      "가중치는 같은 분야 안에서 해당 지표가 차지하는 상대적 중요도입니다.",
    guideContribution:
      "기여도는 정규값에 최신성 보정과 가중치를 적용해 분야 점수에 더한 값입니다.",
  },
  starQuality: {
    title: "별점 품질 평가",
    burst: "별점 급증이 감지되었습니다 — 비정상적으로 별점이 몰린 시점이 있습니다.",
    factor: "품질 계수",
    recentUqs: "최근 UQS",
    historicalUqs: "과거 UQS",
    footnote:
      "UQS(사용자 품질 점수)는 별점을 누른 계정이 실제 활동하는 사용자인지 추정합니다. 최근 100명의 계정 나이·팔로워 수·공개 저장소 수를 사용해 계산합니다.",
  },
  social: {
    hnTitle: "Hacker News",
    stories: "스토리 수",
    points: "총 포인트",
    comments: "댓글",
    topStory: "인기 스토리",
    pts: "점",
    noMentions: "선택한 기간 동안 이 저장소를 언급한 Hacker News 글이 없습니다.",
    redditTitle: "Reddit",
    redditPosts: "게시글",
    redditScore: "점수",
    redditComments: "댓글",
    noRedditMentions:
      "선택한 기간 동안 이 저장소를 언급한 Reddit 게시글이 없습니다.",
    soTitle: "Stack Overflow",
    soQuestions: "질문",
    soAnsweredRatio: "답변율",
    soScore: "점수",
    noSoMentions:
      "선택한 기간 동안 이 저장소를 언급한 Stack Overflow 질문이 없습니다.",
    soViews: "조회수",
    youtubeTitle: "YouTube",
    youtubeVideos: "영상",
    youtubeViews: "총 조회수",
    youtubeLikes: "좋아요",
    noYoutubeMentions:
      "선택한 기간 동안 이 저장소를 언급한 YouTube 영상이 없습니다.",
  },
  language: {
    en: "English",
    ko: "한국어",
    label: "언어",
  },
  nav: {
    home: "RepoPopIndex",
    methodology: "산출 방식",
    about: "소개",
  },
  recentReports: {
    title: "최근 분석 결과",
    emptyState: "아직 분석된 저장소가 없습니다. 저장소를 분석해 시작해 보세요.",
    viewReport: "결과 보기",
    score: "점수",
  },
  methodology: {
    title: "점수 산출 방식",
    intro:
      "RepoPopIndex는 GitHub, HuggingFace, Hacker News, Reddit, Stack Overflow, YouTube에서 50개 이상의 신호를 수집해 0~100점의 종합 활용도 지수를 계산합니다. 각 신호는 로그 정규화 및 가중치 적용을 거쳐 허영 지표가 아닌 실제 활용도를 반영하는 최종 점수로 합산됩니다.",
    categoriesTitle: "점수 분야 및 가중치",
    categoriesBody:
      "GitHub 저장소는 Activity(20%), Community(20%), Adoption(25%), Popularity(15%), Health(5%), Social Buzz(15%)의 여섯 분야로 평가합니다. HuggingFace 모델·데이터셋은 Downloads(25%), Integration(20%), Activity(20%), Community(10%), Popularity(10%), Social Buzz(15%)로 평가합니다. 데이터가 부족한 분야는 제외하고 나머지 분야의 가중치를 비례해 재분배합니다.",
    socialBuzzTitle: "S1 소셜 버즈 세부 소스",
    socialBuzzBody:
      "소셜 버즈 분야는 Hacker News, Reddit, Stack Overflow, YouTube 네 가지 소스를 합산합니다. 서브소스 가중치(HN 48%, Reddit 30%, SO 12%, YT 9%)는 25개 주요 OSS 저장소 실측 데이터로 보정되었습니다. Reddit은 대부분 자격 정보 미설정으로 null 반환, SO/YouTube는 3개월 기간 내 최대 1건 수준입니다. 실제로는 Hacker News가 지배적 신호(Reddit 제외 시 상한의 ~70%)입니다. null 소스는 분자·분모 모두에서 제외되며, 0값 소스는 감소된 가중치로 분모에 남습니다.",
    starAbuseTitle: "별점 품질 및 어뷰징 보정",
    starAbuseBody:
      "조회 가능한 최근 스타게이저 최대 100명을 표본으로 별도의 품질 보정 별점 신호를 계산합니다. 계정 나이·팔로워 수·공개 저장소 수로 UQS 계수(0~1)를 구한 뒤 전체 별점 수와 곱해 G8.1을 만들며, 원시 별점 수는 별도 지표로 유지합니다. 비정상적인 유입 급증은 검토 플래그만 기록하고 품질계수를 자동으로 추가 감점하지 않습니다.",
    formulaTitle: "종합 점수 공식",
    formulaBody:
      "각 지표는 S_i = log(1 + raw) / log(1 + max) 공식으로 정규화합니다(max는 최상위 수준에 맞춰 보정된 상한값). 누적(전체 기간) 지표에는 최신성 계수 0.75를 곱해 스톡 신호와 플로우 신호의 차이를 반영합니다. 분야 내 지표를 가중 평균하여 분야 점수(0~100)를 구하고, 분야 점수를 다시 가중 평균해 최종 종합 점수를 산출합니다.",
    partialTitle: "일부 결과 처리",
    partialBody:
      "핵심 소스가 실패하거나 분야 데이터가 부족하거나 선택적 소스가 요청 제한에 걸리면 리포트에 일부 데이터 경고를 표시합니다. 누락된 지표·분야의 가중치는 사용 가능한 분모에서 제외됩니다. 최근 성공값 백업은 Reddit·Stack Overflow·YouTube에만 제공됩니다.",
  },
  about: {
    title: "RepoPopIndex 소개",
    intro:
      "RepoPopIndex는 오픈소스 저장소가 겉보기에 얼마나 인기 있어 보이는지가 아니라 실제로 얼마나 활발하게 사용되고 있는지를 정량화하는 오픈소스 프로젝트입니다. 별점 어뷰징·일시적 화제성·방치 상태에 흔들리지 않는 신호를 드러내어 기여자와 도입자가 정보에 기반한 판단을 할 수 있도록 돕습니다.",
    missionTitle: "왜 만들었는가",
    missionBody:
      "별 수는 부풀리기 쉽고 가라앉히기 어렵습니다. 주목도는 측정해도 실제 도입은 측정하지 못합니다. 본 프로젝트는 활동성·커뮤니티·다운스트림 통합·릴리스 주기·소셜 논의·프로젝트 건전성을 함께 평가해 저장소의 실질 footprint가 드러나도록 합니다. 잘 꾸며졌지만 멈춰있는 프로젝트와 매주 출시되는 프로젝트가 같은 점수를 받으면 안 됩니다.",
    dataSourcesTitle: "데이터 소스",
    dataSourcesBody:
      "GitHub REST·GraphQL API, HuggingFace Hub API, Hacker News(Algolia), Reddit, Stack Exchange(Stack Overflow), YouTube Data API를 사용합니다. 신호는 요청 시점에 수집해 Upstash Redis에 캐시하고, 월별 스냅샷은 자동 만료 없이 저장합니다. 관계형 데이터베이스는 사용하지 않습니다. 상위 데이터가 변경·삭제될 수 있으므로 나중에 다시 실행한 결과가 과거 스냅샷과 완전히 같다고 보장하지는 않습니다.",
    openSourceTitle: "오픈소스",
    openSourceBody:
      "코드는 MIT 라이선스로 GitHub에 공개되어 있습니다. 점수 산출·가중치·새로운 신호 소스에 대한 이슈·PR·토론을 환영합니다. 현재 점수가 어떻게 계산되는지는 산출 방식 페이지에 정리되어 있습니다.",
    contactTitle: "저장소",
    contactBody: "github.com/9bow/RepoPopIndex",
  },
};

const dict = { en, ko } as const;

export function getDictionary(locale: Locale) {
  return dict[locale];
}

export function scoreLabelKey(score: number): keyof typeof en.scoreGauge {
  if (score >= 80) return "h80";
  if (score >= 60) return "h60";
  if (score >= 40) return "h40";
  if (score >= 20) return "h20";
  return "h0";
}

/** Simple #{name} and {name} replacers */
export function formatTemplate(
  template: string,
  vars: Record<string, string | number>
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`#\\{${k}\\}`, "g"), String(v));
    out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  }
  return out;
}
