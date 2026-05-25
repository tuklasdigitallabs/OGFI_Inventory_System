CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL,
    "prefix" TEXT NOT NULL,
    "sequenceDate" DATE NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_sequences_prefix_sequenceDate_key"
ON "document_sequences"("prefix", "sequenceDate");
