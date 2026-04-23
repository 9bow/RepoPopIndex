CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."period" AS ENUM('1w', '1m', '3m', '6m', '1y');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('github', 'huggingface');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('queued', 'collecting', 'scoring', 'complete', 'partial', 'failed');--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" "platform" NOT NULL,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"period" "period" DEFAULT '3m' NOT NULL,
	"status" "status" DEFAULT 'queued' NOT NULL,
	"input_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "raw_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"source" text NOT NULL,
	"category" text NOT NULL,
	"metric_key" text NOT NULL,
	"raw_value" real,
	"raw_json" jsonb,
	"collected_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"composite_score" real NOT NULL,
	"category_scores" jsonb NOT NULL,
	"metric_scores" jsonb NOT NULL,
	"excluded_categories" jsonb,
	"star_quality_factor" real,
	"star_quality_recent" real,
	"star_quality_historical" real,
	"star_burst_detected" integer DEFAULT 0,
	"scored_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "raw_metrics" ADD CONSTRAINT "raw_metrics_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scores" ADD CONSTRAINT "scores_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analyses_platform_owner_repo" ON "analyses" USING btree ("platform","owner","repo");--> statement-breakpoint
CREATE INDEX "idx_analyses_status" ON "analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_raw_metrics_analysis" ON "raw_metrics" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_raw_metrics_category" ON "raw_metrics" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_scores_analysis" ON "scores" USING btree ("analysis_id");