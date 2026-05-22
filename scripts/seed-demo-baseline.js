#!/usr/bin/env node

const { createHash } = require("crypto");
const { PrismaClient, ReferenceType, TransactionType } = require("@prisma/client");

const prisma = new PrismaClient();

const openingStock = [
  ["MAIN-WH", "BEEF-BRISKET", "42", "415.000000"],
  ["MAIN-WH", "BEEF-SIRLOIN", "18", "520.000000"],
  ["MAIN-WH", "BEEF-GYUDON", "30", "455.000000"],
  ["MAIN-WH", "CHICKEN-THIGH", "55", "185.000000"],
  ["MAIN-WH", "CHICKEN-BREAST", "24", "195.000000"],
  ["MAIN-WH", "PORK-BELLY", "22", "315.000000"],
  ["MAIN-WH", "RICE-JASMINE", "180", "66.000000"],
  ["MAIN-WH", "RICE-JAPANESE", "85", "92.000000"],
  ["MAIN-WH", "NOODLE-RAMEN", "36", "118.000000"],
  ["MAIN-WH", "COOKING-OIL", "65", "78.000000"],
  ["MAIN-WH", "SOY-SAUCE", "44", "72.000000"],
  ["MAIN-WH", "TERIYAKI-SAUCE", "30", "148.000000"],
  ["MAIN-WH", "LETTUCE-ROMAINE", "18", "95.000000"],
  ["MAIN-WH", "BOWL-24OZ", "1600", "5.200000"],
  ["MAIN-WH", "LID-24OZ", "1600", "2.450000"],
  ["MAIN-WH", "SAUCE-CUP-2OZ", "2200", "1.850000"],
  ["MAIN-WH", "CHOPSTICKS", "3000", "0.850000"],
  ["MAIN-WH", "PAPER-BAG-M", "900", "3.150000"],
  ["MAIN-WH", "COKE-CAN", "480", "28.000000"],
  ["MAIN-WH", "BOTTLED-WATER", "360", "16.000000"],
  ["MAIN-WH", "DISHWASHING-LIQUID", "24", "95.000000"],
  ["BGC-01", "RICE-JASMINE", "38", "66.000000"],
  ["BGC-01", "BEEF-GYUDON", "12", "455.000000"],
  ["BGC-01", "CHICKEN-THIGH", "14", "185.000000"],
  ["BGC-01", "SOY-SAUCE", "9", "72.000000"],
  ["BGC-01", "TERIYAKI-SAUCE", "7", "148.000000"],
  ["BGC-01", "BOWL-24OZ", "260", "5.200000"],
  ["BGC-01", "LID-24OZ", "260", "2.450000"],
  ["BGC-01", "COKE-CAN", "60", "28.000000"],
  ["MAKATI-01", "RICE-JASMINE", "22", "66.000000"],
  ["MAKATI-01", "BEEF-GYUDON", "5", "455.000000"],
  ["MAKATI-01", "CHICKEN-THIGH", "7", "185.000000"],
  ["MAKATI-01", "BOWL-24OZ", "120", "5.200000"],
  ["MAKATI-01", "LID-24OZ", "120", "2.450000"],
  ["MAKATI-01", "COKE-CAN", "12", "28.000000"],
  ["QC-01", "RICE-JASMINE", "14", "66.000000"],
  ["QC-01", "BEEF-GYUDON", "3", "455.000000"],
  ["QC-01", "CHICKEN-THIGH", "4", "185.000000"],
  ["QC-01", "BOWL-24OZ", "85", "5.200000"],
  ["QC-01", "LID-24OZ", "85", "2.450000"],
  ["QC-01", "COKE-CAN", "0", "28.000000"],
  ["ORTIGAS-01", "RICE-JASMINE", "17", "66.000000"],
  ["ORTIGAS-01", "BEEF-GYUDON", "6", "455.000000"],
  ["ORTIGAS-01", "CHICKEN-THIGH", "5", "185.000000"],
  ["ORTIGAS-01", "BOWL-24OZ", "95", "5.200000"],
  ["ORTIGAS-01", "LID-24OZ", "95", "2.450000"],
  ["ORTIGAS-01", "BOTTLED-WATER", "18", "16.000000"],
  ["CEBU-01", "RICE-JASMINE", "30", "66.000000"],
  ["CEBU-01", "BEEF-GYUDON", "10", "455.000000"],
  ["CEBU-01", "CHICKEN-THIGH", "11", "185.000000"],
  ["CEBU-01", "SOY-SAUCE", "5", "72.000000"],
  ["CEBU-01", "BOWL-24OZ", "180", "5.200000"],
  ["CEBU-01", "LID-24OZ", "180", "2.450000"],
  ["CEBU-01", "BOTTLED-WATER", "0", "16.000000"],
];

function uuidFromSeed(value) {
  const hash = createHash("md5").update(value).digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

async function seededActor() {
  const configuredEmail = process.env.SEED_ADMIN_EMAIL;

  if (configuredEmail) {
    const configured = await prisma.user.findUnique({
      where: { email: configuredEmail },
    });

    if (configured) {
      return configured;
    }
  }

  return prisma.user.findFirst({
    where: { active: true, role: { code: "ADMIN" } },
    orderBy: { createdAt: "asc" },
  });
}

async function main() {
  const actor = await seededActor();

  if (!actor) {
    throw new Error("An active admin user is required to seed opening stock.");
  }

  const businessDate = new Date("2026-05-01T00:00:00.000Z");

  for (const [locationCode, sku, qty, unitCost] of openingStock) {
    const [location, item] = await Promise.all([
      prisma.location.findUnique({ where: { code: locationCode } }),
      prisma.item.findUnique({ where: { sku } }),
    ]);

    if (!location || !item) {
      console.warn(`Skipping opening stock for missing ${locationCode}/${sku}.`);
      continue;
    }

    const uuid = uuidFromSeed(`opening-stock-v2:${locationCode}:${sku}`);
    const referenceId = uuidFromSeed(
      `opening-stock-v2-reference:${locationCode}:${sku}`,
    );
    const existing = await prisma.ledgerEvent.findUnique({ where: { uuid } });

    if (existing) {
      continue;
    }

    await prisma.ledgerEvent.create({
      data: {
        uuid,
        locationId: location.id,
        itemId: item.id,
        transactionType: TransactionType.ADJUSTMENT,
        qtyIn: qty,
        qtyOut: "0",
        unitCostAtTime: unitCost,
        extendedCost: String(Number(qty) * Number(unitCost)),
        referenceType: ReferenceType.ADJUSTMENT,
        referenceId,
        businessDate,
        createdById: actor.id,
        approvedById: actor.id,
        metadata: {
          seed: "opening-stock-v2",
          locationCode,
          sku,
        },
      },
    });
  }

  console.log("Demo baseline opening stock loaded successfully.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
