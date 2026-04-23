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
  },
  starQuality: {
    title: "Star quality assessment",
    burst: "Star burst detected — unusual spike in starring activity.",
    factor: "Quality factor",
    recentUqs: "Recent UQS",
    historicalUqs: "Historical UQS",
    footnote:
      "UQS (User Quality Score) measures the authenticity of stargazers. Based on mixed sampling: 100 recent + 100 historical stargazers.",
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
    title: "RepoPopIndex — 실제 리포지토리 인기 측정",
    description:
      "GitHub·HuggingFace가 얼마나 쓰이는지 수치로 확인합니다. 50개 이상 지표, 악용 스타 보정, 0~100 합성 점수를 제공합니다.",
  },
  home: {
    title: "RepoPopIndex",
    subtitle:
      "허수 인기가 아닌, 실질적 리포지토리 인기를 측정합니다. 50개 이상 신호, 악용 스타 가중, 하나의 점수.",
    urlPlaceholder: "github.com/… 또는 huggingface.co/… URL",
    period: "기간:",
    analyze: "리포지토리 분석",
    analyzing: "분석 중...",
    footnote: "GitHub 리포지토리와 HuggingFace 모델/데이터셋을 지원합니다. 약 15~30초 소요될 수 있습니다.",
    errUrlEmpty: "리포지토리 URL을 입력해 주세요.",
    errNetwork: "네트워크 오류입니다. 다시 시도해 주세요.",
    err503: "서비스가 혼잡합니다. 잠시 후 다시 시도해 주세요.",
    errAnalysis: "분석을 시작할 수 없습니다. 다시 시도해 주세요.",
  },
  common: {
    loading: "준비 중...",
  },
  report: {
    failTitle: "분석 실패",
    tryAnother: "다른 리포지토리로 다시 시도",
    analyzingTitle: "리포지토리 분석 중...",
    queuePosition: "대기 순번: #{n}번",
    estimatedWait: "— 약 {n}초",
    partialBanner: "일부 데이터 소스를 가져오지 못해, 사용 가능한 데이터만으로 점수를 계산했습니다.",
    categoryOverview: "카테고리 개요",
    categoryBreakdown: "카테고리별 점수",
    starQuality: "스타 품질 분석",
    socialBuzz: "소셜·커뮤니티",
    detailedMetrics: "상세 지표",
    footerFormula:
      "점수 식: S_i = log(1 + raw) / log(1 + max). 카테고리별 가중 평균이며, 누락된 데이터는 비례해 제외합니다.",
    analyzed: "분석 시각",
    period: "기간",
    notFound: "분석을 찾을 수 없습니다.",
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
    index: "인기도 지수",
    h80: "매우 높은 활동",
    h60: "높은 활동",
    h40: "보통",
    h20: "낮은 활동",
    h0: "최소 수준",
  },
  categoryCards: {
    none: "표시할 카테고리가 없습니다.",
    insufficient: "데이터 부족",
  },
  categoryRadar: {
    none: "카테고리 데이터가 없습니다.",
    seriesName: "점수",
  },
  metricsTable: {
    none: "지표가 없습니다.",
    insufficient: "데이터 부족",
    metric: "지표",
    raw: "원본",
    normalized: "정규화",
    weight: "가중",
    contribution: "기여도",
  },
  starQuality: {
    title: "스타 품질 평가",
    burst: "스타 급증이 감지되었습니다 — 비정상적인 스타 집중이 있습니다.",
    factor: "품질 계수",
    recentUqs: "최근 UQS",
    historicalUqs: "과거 UQS",
    footnote:
      "UQS(사용자 품질 점수)는 스타를 준 사용자의 실제성을 추정합니다. 최근 100명 + 과거 100명 혼합 샘플을 기반으로 합니다.",
  },
  social: {
    hnTitle: "Hacker News",
    stories: "스토리 수",
    points: "총 포인트",
    comments: "댓글",
    topStory: "인기 스토리",
    pts: "점",
    noMentions: "선택한 기간에 이 리포지토리에 대한 Hacker News 언급이 없습니다.",
    comingSoon: "Reddit, Stack Overflow, YouTube 지표는 곧 지원 예정입니다.",
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
