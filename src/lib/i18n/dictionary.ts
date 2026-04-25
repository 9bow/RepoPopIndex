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
      "Measure real repository popularity, not vanity metrics. 50+ signals. Anti-abuse star weighting. One score.",
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
    comingSoon: "Reddit, Stack Overflow, and YouTube signals coming soon.",
  },
  language: {
    en: "English",
    ko: "한국어",
    label: "Language",
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
      "표면적인 별점 수가 아닌, 저장소가 실제로 얼마나 활발히 쓰이는지 측정합니다. 50개 이상의 신호와 별점 어뷰징 보정을 하나의 점수로.",
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
    comingSoon: "Reddit, Stack Overflow, YouTube 지표는 곧 추가됩니다.",
  },
  language: {
    en: "English",
    ko: "한국어",
    label: "언어",
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
