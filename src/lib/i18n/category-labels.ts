import type { Locale } from "./dictionary";

const CATEGORY_COPY: Record<
  string,
  { en: { label: string; description: string }; ko: { label: string; description: string } }
> = {
  "G-Activity": {
    en: {
      label: "Development activity",
      description: "How much recent development happened and how broadly contributors participated.",
    },
    ko: {
      label: "개발 활동",
      description: "최근 개발이 얼마나 일어났고 여러 기여자가 얼마나 폭넓게 참여했는지 보여줍니다.",
    },
  },
  "G-Community": {
    en: {
      label: "Community operation",
      description: "How consistently issues and pull requests are answered, closed, and merged.",
    },
    ko: {
      label: "커뮤니티 운영",
      description: "이슈와 PR에 얼마나 꾸준히 응답하고 처리·병합하는지 보여줍니다.",
    },
  },
  "G-Adoption": {
    en: {
      label: "Adoption",
      description: "Signals that the project is released, downloaded, or depended on by other projects.",
    },
    ko: {
      label: "실사용·채택",
      description: "프로젝트가 실제로 배포·다운로드되거나 다른 프로젝트에서 의존하는 정도입니다.",
    },
  },
  "G-Popularity": {
    en: {
      label: "Popularity",
      description: "Public recognition through stars, forks, watchers, and the recent-stargazer quality heuristic.",
    },
    ko: {
      label: "인지도",
      description: "별점·포크·관찰자와 최근 스타게이저 품질 휴리스틱으로 본 공개 인지도입니다.",
    },
  },
  "G-Health": {
    en: {
      label: "Project readiness",
      description: "Availability of contribution guidance and community-facing repository documents.",
    },
    ko: {
      label: "프로젝트 준비도",
      description: "기여 안내와 커뮤니티 운영에 필요한 저장소 문서가 갖춰졌는지 보여줍니다.",
    },
  },
  "G-Social": {
    en: {
      label: "External discussion",
      description: "How much the project is discussed on public technical and media channels.",
    },
    ko: {
      label: "외부 화제도",
      description: "공개 기술 커뮤니티와 미디어 채널에서 프로젝트가 얼마나 언급되는지 보여줍니다.",
    },
  },
  "H-Downloads": {
    en: {
      label: "Downloads",
      description: "Recent and cumulative Hugging Face download traffic; not unique users.",
    },
    ko: {
      label: "다운로드",
      description: "Hugging Face의 최근·누적 다운로드 트래픽이며 고유 사용자 수는 아닙니다.",
    },
  },
  "H-Integration": {
    en: {
      label: "Integration",
      description: "How often the resource is connected to Spaces, inference providers, or derived models.",
    },
    ko: {
      label: "연동·파생 활용",
      description: "Space·추론 공급자·파생 모델과 얼마나 연결되어 활용되는지 보여줍니다.",
    },
  },
  "H-Activity": {
    en: {
      label: "Repository activity",
      description: "Recent commits, contributors, and freshness of the Hugging Face repository.",
    },
    ko: {
      label: "저장소 활동",
      description: "Hugging Face 저장소의 최근 커밋·기여자와 마지막 활동 시점을 보여줍니다.",
    },
  },
  "H-Community": {
    en: {
      label: "Community & documentation",
      description: "Discussions, pull requests, and model-card completeness.",
    },
    ko: {
      label: "커뮤니티·문서",
      description: "토론·PR 활동과 모델 카드의 기본 완성도를 보여줍니다.",
    },
  },
  "H-Popularity": {
    en: {
      label: "Popularity",
      description: "Likes and trending signals on Hugging Face.",
    },
    ko: {
      label: "인지도",
      description: "Hugging Face의 좋아요와 트렌딩 신호로 본 인지도입니다.",
    },
  },
  "H-Social": {
    en: {
      label: "External discussion",
      description: "Public discussion about the resource outside Hugging Face.",
    },
    ko: {
      label: "외부 화제도",
      description: "Hugging Face 밖의 공개 채널에서 이 리소스가 언급되는 정도입니다.",
    },
  },
};

export function getCategoryLabel(
  key: string,
  fallback: string,
  locale: Locale
): string {
  return CATEGORY_COPY[key]?.[locale].label ?? fallback ?? key;
}

export function getCategoryDescription(key: string, locale: Locale): string {
  return (
    CATEGORY_COPY[key]?.[locale].description ??
    (locale === "ko"
      ? "이 분야에 포함된 지표를 종합한 0~100 점수입니다."
      : "A 0–100 score aggregated from the metrics in this category.")
  );
}
