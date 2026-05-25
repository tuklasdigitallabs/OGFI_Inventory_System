import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PriceStatus, Prisma, RoleCode } from "@prisma/client";
import { AuthenticatedUser } from "../auth/types";
import { CostingService } from "../costing/costing.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMenuPriceDto, UpdateMenuPriceDto } from "./dto/menu-pricing.dto";

type Tx = Prisma.TransactionClient;

function decimalValue(value: unknown, fallback = "0") {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return new Prisma.Decimal(fallback);
  }

  return new Prisma.Decimal(String(value));
}

const menuPriceInclude = {
  approvedBy: { select: { fullName: true, id: true } },
  createdBy: { select: { fullName: true, id: true } },
  location: true,
  outputItem: { include: { baseUom: true } },
  recipe: {
    include: {
      lines: {
        include: {
          ingredient: { include: { baseUom: true } },
          uom: true,
        },
      },
      outputItem: { include: { baseUom: true } },
    },
  },
} satisfies Prisma.MenuPriceInclude;

@Injectable()
export class MenuPricingService {
  constructor(
    private readonly costingService: CostingService,
    private readonly prisma: PrismaService,
  ) {}

  async list(query: Record<string, string> = {}, user: AuthenticatedUser) {
    const rows = await this.prisma.menuPrice.findMany({
      where: {
        ...this.locationWhere(query.locationId, user),
        status: query.status as PriceStatus | undefined,
      },
      include: menuPriceInclude,
      orderBy: [{ active: "desc" }, { effectiveDate: "desc" }],
      take: this.parseTake(query.take),
    });

    return {
      resource: "menu-pricing",
      data: await this.withPricingMetrics(this.prisma, rows),
    };
  }

  async create(dto: CreateMenuPriceDto, user: AuthenticatedUser) {
    this.assertPricingAccess(user, "create");
    const channel = this.channel(dto.channel);
    this.assertEffectiveDateRules(
      channel,
      dto.effectiveDate,
      dto.effectiveEndDate,
    );
    const recipe = await this.prisma.recipe.findFirst({
      where: { active: true, id: dto.recipeId },
      select: { outputItemId: true },
    });

    if (!recipe) {
      throw new BadRequestException("Recipe must exist and be active.");
    }

    const row = await this.prisma.menuPrice.create({
      data: {
        channel,
        createdById: user.id,
        effectiveDate: new Date(dto.effectiveDate),
        effectiveEndDate: this.effectiveEndDate(dto.effectiveEndDate),
        locationId: dto.locationId,
        notes: this.optionalText(dto.notes),
        outputItemId: recipe.outputItemId,
        recipeId: dto.recipeId,
        sellingPrice: new Prisma.Decimal(dto.sellingPrice),
        targetFoodCostPercent:
          dto.targetFoodCostPercent === undefined
            ? undefined
            : new Prisma.Decimal(dto.targetFoodCostPercent),
        targetGrossMarginPercent:
          dto.targetGrossMarginPercent === undefined
            ? undefined
            : new Prisma.Decimal(dto.targetGrossMarginPercent),
      },
      include: menuPriceInclude,
    });

    return this.withOnePricingMetrics(this.prisma, row);
  }

  async update(id: string, dto: UpdateMenuPriceDto, user: AuthenticatedUser) {
    this.assertPricingAccess(user, "create");
    const before = await this.requiredMenuPrice(id);

    if (before.status === PriceStatus.APPROVED) {
      throw new BadRequestException("Approved prices cannot be edited.");
    }
    const nextChannel =
      dto.channel === undefined ? before.channel : this.channel(dto.channel);
    const nextEffectiveDate =
      dto.effectiveDate === undefined
        ? before.effectiveDate.toISOString()
        : dto.effectiveDate;
    const nextEffectiveEndDate =
      dto.effectiveEndDate === undefined
        ? before.effectiveEndDate?.toISOString()
        : dto.effectiveEndDate;
    this.assertEffectiveDateRules(
      nextChannel,
      nextEffectiveDate,
      nextEffectiveEndDate,
    );

    const row = await this.prisma.menuPrice.update({
      where: { id },
      data: {
        channel: dto.channel === undefined ? undefined : nextChannel,
        effectiveDate:
          dto.effectiveDate === undefined
            ? undefined
            : new Date(dto.effectiveDate),
        effectiveEndDate:
          dto.effectiveEndDate === undefined
            ? undefined
            : this.effectiveEndDate(dto.effectiveEndDate),
        locationId: dto.locationId,
        notes:
          dto.notes === undefined ? undefined : this.optionalText(dto.notes),
        sellingPrice:
          dto.sellingPrice === undefined
            ? undefined
            : new Prisma.Decimal(dto.sellingPrice),
        targetFoodCostPercent:
          dto.targetFoodCostPercent === undefined ||
          dto.targetFoodCostPercent === null
            ? dto.targetFoodCostPercent
            : new Prisma.Decimal(dto.targetFoodCostPercent),
        targetGrossMarginPercent:
          dto.targetGrossMarginPercent === undefined ||
          dto.targetGrossMarginPercent === null
            ? dto.targetGrossMarginPercent
            : new Prisma.Decimal(dto.targetGrossMarginPercent),
      },
      include: menuPriceInclude,
    });

    return this.withOnePricingMetrics(this.prisma, row);
  }

  async cloneToDraft(id: string, user: AuthenticatedUser) {
    this.assertPricingAccess(user, "create");
    const before = await this.requiredMenuPrice(id);

    const row = await this.prisma.menuPrice.create({
      data: {
        channel: before.channel,
        createdById: user.id,
        effectiveDate: before.effectiveDate,
        effectiveEndDate: before.effectiveEndDate,
        locationId: before.locationId,
        notes: before.notes,
        outputItemId: before.outputItemId,
        recipeId: before.recipeId,
        sellingPrice: before.sellingPrice,
        targetFoodCostPercent: before.targetFoodCostPercent,
        targetGrossMarginPercent: before.targetGrossMarginPercent,
      },
      include: menuPriceInclude,
    });

    return this.withOnePricingMetrics(this.prisma, row);
  }

  async submit(id: string, user: AuthenticatedUser) {
    this.assertPricingAccess(user, "create");
    await this.requiredMenuPrice(id);

    const row = await this.prisma.menuPrice.update({
      where: { id },
      data: { status: PriceStatus.PENDING_APPROVAL },
      include: menuPriceInclude,
    });

    return this.withOnePricingMetrics(this.prisma, row);
  }

  async approve(id: string, user: AuthenticatedUser) {
    this.assertPricingAccess(user, "approve");

    return this.prisma.$transaction(async (tx) => {
      const before = await this.requiredMenuPrice(id, tx);

      if (before.status !== PriceStatus.PENDING_APPROVAL) {
        throw new BadRequestException("Only pending prices can be approved.");
      }

      await tx.menuPrice.updateMany({
        where: {
          active: true,
          channel: before.channel,
          locationId: before.locationId,
          outputItemId: before.outputItemId,
          status: PriceStatus.APPROVED,
        },
        data: { active: false, status: PriceStatus.ARCHIVED },
      });

      const row = await tx.menuPrice.update({
        where: { id },
        data: {
          active: true,
          approvedAt: new Date(),
          approvedById: user.id,
          status: PriceStatus.APPROVED,
        },
        include: menuPriceInclude,
      });

      return this.withOnePricingMetrics(tx, row);
    });
  }

  private async requiredMenuPrice(
    id: string,
    tx: Tx | PrismaService = this.prisma,
  ) {
    const row = await tx.menuPrice.findUnique({
      where: { id },
      include: menuPriceInclude,
    });

    if (!row) {
      throw new NotFoundException("Menu price not found.");
    }

    return row;
  }

  private async withPricingMetrics<
    T extends { recipe: Record<string, unknown> },
  >(tx: Tx | PrismaService, rows: T[]) {
    return Promise.all(rows.map((row) => this.withOnePricingMetrics(tx, row)));
  }

  private async withOnePricingMetrics<
    T extends { recipe: Record<string, unknown> },
  >(tx: Tx | PrismaService, row: T) {
    const recipeCost = await this.calculateRecipeCost(tx, row.recipe);
    const sellingPrice = decimalValue(
      (row as Record<string, unknown>).sellingPrice,
    );
    const foodCostPercent = sellingPrice.gt(0)
      ? recipeCost.costPerServing.div(sellingPrice).mul(100)
      : new Prisma.Decimal(0);
    const grossProfit = sellingPrice.sub(recipeCost.costPerServing);
    const grossMarginPercent = sellingPrice.gt(0)
      ? grossProfit.div(sellingPrice).mul(100)
      : new Prisma.Decimal(0);
    const expired = this.isExpired(row as Record<string, unknown>);

    return {
      ...row,
      costPerServing: recipeCost.costPerServing.toFixed(6),
      costingWarnings: recipeCost.costingWarnings,
      displayStatus: expired
        ? "EXPIRED"
        : (row as Record<string, unknown>).status,
      expired,
      foodCostPercent: foodCostPercent.toFixed(2),
      grossMarginPercent: grossMarginPercent.toFixed(2),
      grossProfit: grossProfit.toFixed(6),
      totalRecipeCost: recipeCost.totalRecipeCost.toFixed(6),
      usableServingQty: recipeCost.usableServingQty.toFixed(6),
    };
  }

  private async calculateRecipeCost(
    tx: Tx | PrismaService,
    recipe: Record<string, unknown>,
  ) {
    let totalRecipeCost = new Prisma.Decimal(0);
    const costingWarnings: string[] = [];
    const wastageMultiplier = new Prisma.Decimal(1).add(
      decimalValue(recipe.wastageFactor).div(100),
    );

    for (const line of recipe.lines as Array<Record<string, unknown>>) {
      const ingredient = line.ingredient as Record<string, unknown> | undefined;

      if (!ingredient?.id || !ingredient.baseUomId) {
        costingWarnings.push("Recipe line is missing ingredient master data.");
        continue;
      }

      const conversionFactor = await this.recipeLineConversionFactor(
        tx,
        String(line.uomId),
        String(ingredient.baseUomId),
        String(ingredient.sku ?? ingredient.name ?? "Ingredient"),
        costingWarnings,
      );
      const qtyInBaseUom = decimalValue(line.qty).mul(conversionFactor);
      const adjustedQty = qtyInBaseUom.mul(wastageMultiplier);
      const unitCost = await this.currentIngredientUnitCost(
        tx,
        String(ingredient.id),
      );

      if (unitCost.lte(0)) {
        costingWarnings.push(
          `${String(ingredient.sku ?? ingredient.name ?? "Ingredient")} has no moving average or supplier cost.`,
        );
      }

      totalRecipeCost = totalRecipeCost.add(adjustedQty.mul(unitCost));
    }

    const usableServingQty = decimalValue(recipe.servingQty).mul(
      decimalValue(recipe.yieldPercent, "100").div(100),
    );

    return {
      costPerServing: usableServingQty.gt(0)
        ? totalRecipeCost.div(usableServingQty)
        : new Prisma.Decimal(0),
      costingWarnings,
      totalRecipeCost,
      usableServingQty,
    };
  }

  private async recipeLineConversionFactor(
    tx: Tx | PrismaService,
    fromUomId: string,
    toUomId: string,
    ingredientLabel: string,
    costingWarnings: string[],
  ) {
    if (fromUomId === toUomId) {
      return new Prisma.Decimal(1);
    }

    const conversion = await tx.uomConversion.findUnique({
      where: { fromUomId_toUomId: { fromUomId, toUomId } },
    });

    if (!conversion) {
      costingWarnings.push(
        `${ingredientLabel} is missing UOM conversion for costing.`,
      );
      return new Prisma.Decimal(0);
    }

    return conversion.factor;
  }

  private async currentIngredientUnitCost(
    tx: Tx | PrismaService,
    itemId: string,
  ) {
    const events = await tx.ledgerEvent.findMany({
      where: { itemId },
      orderBy: [{ businessDate: "asc" }, { createdAt: "asc" }],
    });
    const state = this.costingService.calculateState(events);

    if (state.averageUnitCost.gt(0)) {
      return state.averageUnitCost;
    }

    const supplierItem = await tx.supplierItem.findFirst({
      where: { active: true, itemId, unitCost: { not: null } },
      orderBy: [{ updatedAt: "desc" }],
    });

    return supplierItem?.unitCost ?? new Prisma.Decimal(0);
  }

  private assertPricingAccess(
    user: AuthenticatedUser,
    action: "approve" | "create",
  ) {
    const allowed =
      user.role.code === RoleCode.ADMIN ||
      user.role.code === RoleCode.WAREHOUSE_MANAGER;

    if (!allowed) {
      throw new ForbiddenException(
        `Only warehouse or HQ users can ${action} menu pricing.`,
      );
    }
  }

  private assertLocationAccess(user: AuthenticatedUser, locationId: string) {
    if (!user.locationIds.includes(locationId)) {
      throw new ForbiddenException("Location access denied.");
    }
  }

  private locationWhere(locationId?: string, user?: AuthenticatedUser) {
    if (locationId) {
      if (user) {
        this.assertLocationAccess(user, locationId);
      }
      return { locationId };
    }

    return user
      ? { OR: [{ locationId: null }, { locationId: { in: user.locationIds } }] }
      : {};
  }

  private channel(value?: string) {
    const channel = value?.trim().toUpperCase() || "BASE";

    if (!channel) {
      throw new BadRequestException("Channel is required.");
    }

    return channel;
  }

  private effectiveEndDate(value?: string | null) {
    return value ? new Date(value) : null;
  }

  private isExpired(row: Record<string, unknown>) {
    const endDate = row.effectiveEndDate;

    if (row.status !== PriceStatus.APPROVED || !(endDate instanceof Date)) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalizedEndDate = new Date(endDate);
    normalizedEndDate.setHours(0, 0, 0, 0);

    return normalizedEndDate < today;
  }

  private assertEffectiveDateRules(
    channel: string,
    effectiveDate: string,
    effectiveEndDate?: string | null,
  ) {
    if (channel === "PROMO" && !effectiveEndDate) {
      throw new BadRequestException("Promo prices require an end date.");
    }

    if (!effectiveEndDate) {
      return;
    }

    if (new Date(effectiveEndDate) < new Date(effectiveDate)) {
      throw new BadRequestException(
        "Effective end date cannot be before effective date.",
      );
    }
  }

  private optionalText(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private parseTake(value?: string) {
    if (!value) {
      return 100;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) {
      throw new BadRequestException(
        "take must be an integer between 1 and 500.",
      );
    }

    return parsed;
  }
}
