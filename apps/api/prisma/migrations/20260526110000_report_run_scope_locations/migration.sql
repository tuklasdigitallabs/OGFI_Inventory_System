ALTER TABLE "report_runs"
ADD COLUMN "scopeLocationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "report_runs_scopeLocationIds_idx"
ON "report_runs" USING GIN ("scopeLocationIds");
