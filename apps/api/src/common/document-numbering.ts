import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

export async function nextBusinessDocumentNumber(
  tx: Prisma.TransactionClient,
  prefix: string,
  date = new Date(),
) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const sequenceDate = new Date(Date.UTC(year, month, day));
  const datePart = `${year}${String(month + 1).padStart(2, "0")}${String(day).padStart(2, "0")}`;
  const rows = await tx.$queryRaw<Array<{ value: number | bigint }>>`
    INSERT INTO "document_sequences" ("id", "prefix", "sequenceDate", "value", "updatedAt")
    VALUES (${randomUUID()}::uuid, ${prefix}, ${sequenceDate}, 1, NOW())
    ON CONFLICT ("prefix", "sequenceDate")
    DO UPDATE SET "value" = "document_sequences"."value" + 1, "updatedAt" = NOW()
    RETURNING "value"
  `;
  const value = Number(rows[0]?.value ?? 1);

  return `${prefix}-${datePart}-${String(value).padStart(4, "0")}`;
}
