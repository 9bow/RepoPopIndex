import ExcelJS from "exceljs";
import type { AnalysisReport } from "@/lib/types";
import type {
  ManagedContributor,
  StargazerDistribution,
} from "./types";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function createReportMetricsCsv(report: AnalysisReport): string {
  const rows: unknown[][] = [
    [
      "category",
      "metric_key",
      "raw_value",
      "normalized_value",
      "weighted_value",
    ],
  ];
  for (const [categoryKey, category] of Object.entries(report.categoryScores)) {
    for (const [metricKey, metric] of Object.entries(category.metrics)) {
      rows.push([
        categoryKey,
        metricKey,
        metric.raw,
        metric.normalized,
        metric.weighted,
      ]);
    }
  }
  return `\uFEFF${rows
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\n")}`;
}

function styleSheet(sheet: ExcelJS.Worksheet) {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF173B33" },
  };
  header.alignment = { vertical: "middle" };
  header.height = 24;
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: Math.max(1, sheet.columnCount) },
  };
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF2F6F3" },
      };
    }
    row.alignment = { vertical: "top", wrapText: true };
  });
}

export async function createReportWorkbook(input: {
  report: AnalysisReport;
  contributors: ManagedContributor[];
  stargazers: StargazerDistribution | null;
}): Promise<Buffer> {
  const { report, contributors, stargazers } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "RepoPopIndex";
  workbook.created = new Date(report.completedAt ?? report.createdAt);
  workbook.modified = new Date();
  workbook.subject = `${report.owner}/${report.repo} monthly open-source report`;

  const overview = workbook.addWorksheet("요약");
  overview.columns = [
    { header: "항목", key: "key", width: 28 },
    { header: "값", key: "value", width: 48 },
  ];
  overview.addRows([
    { key: "저장소", value: `${report.owner}/${report.repo}` },
    { key: "플랫폼", value: report.platform },
    { key: "분석 기간", value: report.period },
    { key: "상태", value: report.status },
    { key: "종합 점수", value: report.compositeScore },
    { key: "분석 완료 시각", value: report.completedAt },
    { key: "점수 버전", value: report.scoreVersion ?? "v1" },
    {
      key: "누락·영향 소스",
      value: report.partial?.missingSources.join(", ") ?? "",
    },
    {
      key: "관리자 확인 내부 기여자",
      value: contributors.filter((contributor) => contributor.internal).length,
    },
    {
      key: "그 외 기여자",
      value: contributors.filter((contributor) => !contributor.internal).length,
    },
  ]);
  styleSheet(overview);

  const categories = workbook.addWorksheet("분야 점수");
  categories.columns = [
    { header: "분야 ID", key: "id", width: 24 },
    { header: "분야명", key: "name", width: 28 },
    { header: "점수", key: "score", width: 14 },
    { header: "데이터 부족", key: "insufficient", width: 16 },
    { header: "사유", key: "reason", width: 48 },
  ];
  categories.addRows(
    Object.entries(report.categoryScores).map(([id, category]) => ({
      id,
      name: category.name,
      score: category.insufficient ? null : category.score,
      insufficient: category.insufficient ? "예" : "아니오",
      reason: category.reason ?? "",
    }))
  );
  styleSheet(categories);

  const metrics = workbook.addWorksheet("전체 지표");
  metrics.columns = [
    { header: "분야 ID", key: "category", width: 24 },
    { header: "지표 ID", key: "metric", width: 32 },
    { header: "원시값", key: "raw", width: 18 },
    { header: "정규값", key: "normalized", width: 18 },
    { header: "가중 기여도", key: "weighted", width: 18 },
  ];
  metrics.addRows(
    Object.entries(report.categoryScores).flatMap(([categoryKey, category]) =>
      Object.entries(category.metrics).map(([metricKey, metric]) => ({
        category: categoryKey,
        metric: metricKey,
        raw: metric.raw,
        normalized: metric.normalized,
        weighted: metric.weighted,
      }))
    )
  );
  styleSheet(metrics);

  const monthly = workbook.addWorksheet("월별 기여자");
  monthly.columns = [
    { header: "월", key: "month", width: 12 },
    { header: "커밋", key: "commits", width: 12 },
    { header: "PR", key: "pullRequests", width: 12 },
    { header: "이슈", key: "issues", width: 12 },
    { header: "활동 기여자", key: "activeContributors", width: 16 },
    { header: "관측 신규", key: "observedNewContributors", width: 16 },
    { header: "재참여율", key: "retentionRate", width: 14 },
    { header: "저장소 연관", key: "affiliatedContributors", width: 16 },
    { header: "기타 공개", key: "externalContributors", width: 16 },
    { header: "분류 불가", key: "unknownAssociationContributors", width: 16 },
  ];
  monthly.addRows(report.contributorInsights?.monthly ?? []);
  monthly.getColumn("retentionRate").numFmt = "0.0%";
  styleSheet(monthly);

  const contributorSheet = workbook.addWorksheet("기여자 명부");
  contributorSheet.columns = [
    { header: "GitHub node ID", key: "nodeId", width: 34 },
    { header: "GitHub 숫자 ID", key: "databaseId", width: 18 },
    { header: "로그인", key: "login", width: 24 },
    { header: "내부 직원", key: "internal", width: 14 },
    { header: "기여 수", key: "contributions", width: 12 },
    { header: "수집 경로", key: "sources", width: 28 },
    { header: "최초 관측", key: "firstObservedAt", width: 24 },
    { header: "최근 관측", key: "lastObservedAt", width: 24 },
    { header: "프로필", key: "profileUrl", width: 44 },
  ];
  contributorSheet.addRows(
    contributors.map((contributor) => ({
      ...contributor,
      internal: contributor.internal ? "예" : "아니오",
      sources: contributor.sources.join(", "),
    }))
  );
  styleSheet(contributorSheet);

  const starSheet = workbook.addWorksheet("Stargazer 분포");
  starSheet.columns = [
    { header: "계정 연령 구간", key: "label", width: 24 },
    { header: "최소 일수", key: "minDays", width: 14 },
    { header: "최대 일수", key: "maxDays", width: 14 },
    { header: "계정 수", key: "count", width: 14 },
  ];
  starSheet.addRows(stargazers?.ageBuckets ?? []);
  styleSheet(starSheet);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
