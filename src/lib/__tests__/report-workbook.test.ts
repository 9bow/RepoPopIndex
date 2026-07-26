import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createReportWorkbook } from "@/lib/admin/report-export";
import type { AnalysisReport } from "@/lib/types";

describe("createReportWorkbook", () => {
  it("creates a native XLSX with report and contributor sheets", async () => {
    const report: AnalysisReport = {
      id: "analysis-1",
      platform: "github",
      owner: "owner",
      repo: "repo",
      period: "1y",
      status: "complete",
      compositeScore: 72,
      categoryScores: {
        Activity: {
          name: "Activity",
          score: 72,
          maxScore: 100,
          insufficient: false,
          metrics: {
            commits: { raw: 10, normalized: 0.5, weighted: 0.5 },
          },
        },
      },
      excludedCategories: [],
      starQuality: null,
      socialBuzz: {
        hn: null,
        reddit: null,
        stackoverflow: null,
        youtube: null,
      },
      scoreVersion: "v2",
      partial: null,
      createdAt: "2026-07-01T00:00:00Z",
      completedAt: "2026-07-01T00:01:00Z",
    };
    const buffer = await createReportWorkbook({
      report,
      contributors: [],
      stargazers: null,
    });
    expect(buffer.subarray(0, 2).toString()).toBe("PK");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(
      expect.arrayContaining(["요약", "전체 지표", "기여자 명부"])
    );
  });
});
