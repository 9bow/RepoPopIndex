import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  uuid,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";

export const platformEnum = pgEnum("platform", ["github", "huggingface"]);

export const statusEnum = pgEnum("status", [
  "queued",
  "collecting",
  "scoring",
  "complete",
  "partial",
  "failed",
]);

export const periodEnum = pgEnum("period", ["1w", "1m", "3m", "6m", "1y"]);

export const analyses = pgTable(
  "analyses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    platform: platformEnum("platform").notNull(),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    period: periodEnum("period").notNull().default("3m"),
    status: statusEnum("status").notNull().default("queued"),
    inputUrl: text("input_url").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    error: text("error"),
  },
  (table) => [
    index("idx_analyses_platform_owner_repo").on(
      table.platform,
      table.owner,
      table.repo
    ),
    index("idx_analyses_status").on(table.status),
  ]
);

export const rawMetrics = pgTable(
  "raw_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    analysisId: uuid("analysis_id")
      .references(() => analyses.id, { onDelete: "cascade" })
      .notNull(),
    source: text("source").notNull(),
    category: text("category").notNull(),
    metricKey: text("metric_key").notNull(),
    rawValue: real("raw_value"),
    rawJson: jsonb("raw_json"),
    collectedAt: timestamp("collected_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_raw_metrics_analysis").on(table.analysisId),
    index("idx_raw_metrics_category").on(table.category),
  ]
);

export const scores = pgTable(
  "scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    analysisId: uuid("analysis_id")
      .references(() => analyses.id, { onDelete: "cascade" })
      .notNull(),
    compositeScore: real("composite_score").notNull(),
    categoryScores: jsonb("category_scores").notNull(),
    metricScores: jsonb("metric_scores").notNull(),
    excludedCategories: jsonb("excluded_categories"),
    starQualityFactor: real("star_quality_factor"),
    starQualityRecent: real("star_quality_recent"),
    starQualityHistorical: real("star_quality_historical"),
    starBurstDetected: integer("star_burst_detected").default(0),
    // HN display data stored here so the report API never needs to JOIN raw_metrics.
    // raw_metrics still keeps the original rows for auditing / re-scoring.
    hnData: jsonb("hn_data"),
    scoredAt: timestamp("scored_at").defaultNow().notNull(),
  },
  (table) => [index("idx_scores_analysis").on(table.analysisId)]
);
