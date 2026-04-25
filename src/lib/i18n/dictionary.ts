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
    starQuality: "Star quality analysis",
    socialBuzz: "Social buzz",
    detailedMetrics: "Detailed metrics",
    footerFormula:
      "Score formula: S_i = log(1 + raw) / log(1 + max). Categories are weighted and averaged. Missing data is excluded proportionally.",
    analyzed: "Analyzed",
    period: "Period",
    notFound: "Analysis not found",
    loadFailed: "Failed to load report",
    notReady: "Report not ready",
    partialResult: "Partial result",
    partialMissing: "missing",
    lastViewBanner: "Showing your last view of this report — refreshing…",
    periods: {
      "1w": "1 week",
      "1m": "1 month",
      "3m": "3 months",
      "6m": "6 months",
      "1y": "1 year",
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
      "The Social Buzz category aggregates four sources with the following sub-weights: Hacker News 40%, Reddit 25%, Stack Overflow 20%, YouTube 15%. Each source's metrics (post count, points, engagement, etc.) are log-normalized and combined. If a source is unavailable (rate-limited, unconfigured, or served from backup), its weight is redistributed across the remaining active sources.",
    starAbuseTitle: "Star quality & abuse correction",
    starAbuseBody:
      "Raw star counts are adjusted by a User Quality Score (UQS) computed from the 100 most recent stargazers. Each account is evaluated on age, follower count, and public repository count. The resulting quality factor (0–1) scales the star-based popularity score. When an unusual spike in starring activity is detected, a burst flag is recorded and the quality factor is reduced further.",
    formulaTitle: "Composite score formula",
    formulaBody:
      "Each metric is normalized as: S_i = log(1 + raw) / log(1 + max), where max is a calibrated ceiling for top-tier values. Cumulative (all-time) metrics are multiplied by a recency factor of 0.75 to discount stock signals vs. flow signals. Metrics within a category are weight-averaged into a category score (0–100). Category scores are then weight-averaged into the final composite score.",
    partialTitle: "Partial results",
    partialBody:
      "When one or more data sources fail or are rate-limited, the report is marked as partial. The missing sources are listed and their weights are redistributed proportionally so the score remains meaningful. A backup of the most recent successful collection is used when available (reason: served_from_backup). Partial reports are clearly flagged in the UI.",
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
      "GitHub REST and GraphQL APIs, the HuggingFace Hub API, Hacker News (Algolia), Reddit, Stack Exchange (Stack Overflow), and YouTube Data API. Every signal is fetched on demand, log-normalized, and cached in Upstash Redis. There is no persistent database — analyses are reproducible from public APIs.",
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
    starQuality: "별점 품질 분석",
    socialBuzz: "커뮤니티 반응",
    detailedMetrics: "상세 지표",
    footerFormula:
      "점수 식: S_i = log(1 + raw) / log(1 + max). 카테고리별 가중 평균이며, 누락된 데이터는 비례해 제외합니다.",
    analyzed: "분석 일시",
    period: "기간",
    notFound: "분석 결과를 찾을 수 없습니다.",
    loadFailed: "리포트를 불러오지 못했습니다.",
    notReady: "리포트가 아직 준비되지 않았습니다.",
    partialResult: "일부 결과",
    partialMissing: "누락된 소스",
    lastViewBanner: "마지막으로 저장된 보고서를 표시 중입니다 — 갱신 중…",
    periods: {
      "1w": "1주",
      "1m": "1개월",
      "3m": "3개월",
      "6m": "6개월",
      "1y": "1년",
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
      "소셜 버즈 분야는 네 가지 소스를 합산합니다: Hacker News 40%, Reddit 25%, Stack Overflow 20%, YouTube 15%. 각 소스의 게시글 수·포인트·참여도 등 지표를 로그 정규화 후 결합합니다. 소스가 응답하지 않거나 사용 불가 상태일 경우 해당 가중치를 나머지 소스에 비례 재분배합니다.",
    starAbuseTitle: "별점 품질 및 어뷰징 보정",
    starAbuseBody:
      "원시 별점 수는 최근 100명의 스타게이저를 대상으로 계산한 UQS(사용자 품질 점수)로 보정합니다. 계정 나이·팔로워 수·공개 저장소 수를 기준으로 품질 계수(0~1)를 산출해 별점 기반 점수를 조정합니다. 비정상적인 별점 급증이 감지되면 품질 계수를 추가로 낮추고 급증 플래그를 기록합니다.",
    formulaTitle: "종합 점수 공식",
    formulaBody:
      "각 지표는 S_i = log(1 + raw) / log(1 + max) 공식으로 정규화합니다(max는 최상위 수준에 맞춰 보정된 상한값). 누적(전체 기간) 지표에는 최신성 계수 0.75를 곱해 스톡 신호와 플로우 신호의 차이를 반영합니다. 분야 내 지표를 가중 평균하여 분야 점수(0~100)를 구하고, 분야 점수를 다시 가중 평균해 최종 종합 점수를 산출합니다.",
    partialTitle: "일부 결과 처리",
    partialBody:
      "하나 이상의 데이터 소스가 실패하거나 요청 제한에 걸린 경우 리포트는 '일부 결과'로 표시됩니다. 누락된 소스 목록이 표시되며 해당 가중치는 나머지 소스에 비례 재분배되어 점수의 의미가 유지됩니다. 가장 최근의 성공적인 수집 데이터가 있으면 백업으로 사용됩니다(reason: served_from_backup). 일부 결과 리포트는 UI에서 명확히 표시됩니다.",
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
      "GitHub REST·GraphQL API, HuggingFace Hub API, Hacker News(Algolia), Reddit, Stack Exchange(Stack Overflow), YouTube Data API를 사용합니다. 모든 신호는 요청 시점에 수집되어 로그 정규화 후 Upstash Redis에 캐시됩니다. 영구 데이터베이스는 사용하지 않으며, 모든 분석은 공개 API만으로 재현 가능합니다.",
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
