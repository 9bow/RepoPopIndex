import type { Locale } from "./dictionary";

/** Server sends English stage strings; map to Korean for UI when locale is ko. */
const STAGE_KO: Record<string, string> = {
  "Starting collectors...": "수집기를 시작하는 중...",
  "Collecting GitHub metrics...": "GitHub 지표를 수집하는 중...",
  "GitHub GraphQL done": "GitHub GraphQL 완료",
  "GitHub Search done": "GitHub 검색 완료",
  "GitHub REST done": "GitHub REST 완료",
  "Dependents done": "의존 수집 완료",
  "Star quality done": "스타 품질 분석 완료",
  "Collecting HuggingFace metrics...": "Hugging Face 지표를 수집하는 중...",
  "HuggingFace done": "Hugging Face 완료",
  "Social buzz done": "소셜 반응 수집 완료",
  "Storing raw metrics...": "원시 지표를 저장하는 중...",
  "Computing scores...": "점수를 계산하는 중...",
  "Storing scores...": "점수를 저장하는 중...",
  queued: "대기 중",
  collecting: "수집 중",
  scoring: "점수 산출 중",
  complete: "완료",
  partial: "부분 완료",
  failed: "실패",
  "Total timeout exceeded": "전체 시간 초과",
  "Unknown error": "알 수 없는 오류",
};

export function translateStage(stage: string, locale: Locale): string {
  if (locale === "en") return stage;
  return STAGE_KO[stage] ?? stage;
}
