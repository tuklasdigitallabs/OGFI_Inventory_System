import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, RoleCode } from "@prisma/client";
import { AuthenticatedUser } from "../auth/types";
import { CostingService } from "../costing/costing.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCategoryDto,
  CreateItemDto,
  CreateLocationDto,
  CreateReasonCodeDto,
  CreateRecipeDto,
  CreateRecipeYieldObservationDto,
  CreateSupplierDto,
  CreateUomConversionDto,
  CreateUomDto,
  UpdateCategoryDto,
  UpdateItemDto,
  UpdateLocationDto,
  UpdateReasonCodeDto,
  UpdateRecipeDto,
  UpdateSupplierDto,
  UpdateUomConversionDto,
  UpdateUomDto,
} from "./dto/master-data.dto";

interface RequestAuditMetadata {
  ipAddress?: string;
  userAgent?: string;
}

type MasterDataResource =
  | "items"
  | "uoms"
  | "uom-conversions"
  | "suppliers"
  | "locations"
  | "categories"
  | "reason-codes"
  | "recipes";

type Tx = Prisma.TransactionClient;

const resourceConfig: Record<MasterDataResource, { entityType: string }> = {
  categories: { entityType: "Category" },
  items: { entityType: "Item" },
  locations: { entityType: "Location" },
  "reason-codes": { entityType: "ReasonCode" },
  recipes: { entityType: "Recipe" },
  suppliers: { entityType: "Supplier" },
  uoms: { entityType: "Uom" },
  "uom-conversions": { entityType: "UomConversion" },
};

const itemInclude = {
  baseUom: true,
  category: true,
  looseRemainderUom: true,
  looseWholeUom: true,
} satisfies Prisma.ItemInclude;

const recipeInclude = {
  outputItem: { include: { baseUom: true } },
  lines: { include: { ingredient: { include: { baseUom: true } }, uom: true } },
  yieldObservations: {
    orderBy: { createdAt: "desc" },
    take: 5,
  },
} satisfies Prisma.RecipeInclude;

function relatedSkuOrName(record: Record<string, unknown>) {
  return String(record.sku ?? record.name ?? record.id ?? "Ingredient");
}

function decimalValue(value: unknown, fallback = "0") {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  if (value === null || value === undefined || value === "") {
    return new Prisma.Decimal(fallback);
  }

  return new Prisma.Decimal(String(value));
}

@Injectable()
export class MasterDataService {
  constructor(
    private readonly costingService: CostingService,
    private readonly prisma: PrismaService,
  ) {}

  async list(resource: MasterDataResource, query: Record<string, string> = {}) {
    const where = this.listWhere(query);
    const take = this.parseTake(query.take);

    switch (resource) {
      case "items":
        return {
          resource,
          data: await this.prisma.item.findMany({
            where: {
              ...where,
              OR: this.search(query.search, ["sku", "name"]),
              categoryId: query.categoryId,
              itemType: query.itemType as never,
            },
            include: itemInclude,
            orderBy: [{ sku: "asc" }],
            take,
          }),
        };
      case "uoms":
        return {
          resource,
          data: await this.prisma.uom.findMany({
            where: {
              ...where,
              OR: this.search(query.search, ["code", "name"]),
            },
            orderBy: [{ code: "asc" }],
            take,
          }),
        };
      case "uom-conversions":
        return {
          resource,
          data: await this.prisma.uomConversion.findMany({
            where: {
              fromUomId: query.fromUomId,
              toUomId: query.toUomId,
            },
            include: { fromUom: true, toUom: true },
            orderBy: [{ createdAt: "desc" }],
            take,
          }),
        };
      case "suppliers":
        return {
          resource,
          data: await this.prisma.supplier.findMany({
            where: {
              ...where,
              OR: this.search(query.search, [
                "name",
                "contactName",
                "email",
                "phone",
              ]),
            },
            orderBy: [{ name: "asc" }],
            take,
          }),
        };
      case "locations":
        return {
          resource,
          data: await this.prisma.location.findMany({
            where: {
              ...where,
              OR: this.search(query.search, ["code", "name"]),
              type: query.type as never,
            },
            orderBy: [{ code: "asc" }],
            take,
          }),
        };
      case "categories":
        return {
          resource,
          data: await this.prisma.category.findMany({
            where: { ...where, OR: this.search(query.search, ["name"]) },
            orderBy: [{ name: "asc" }],
            take,
          }),
        };
      case "reason-codes":
        return {
          resource,
          data: await this.prisma.reasonCode.findMany({
            where: {
              ...where,
              OR: this.search(query.search, ["code", "name"]),
              type: query.type as never,
            },
            orderBy: [{ type: "asc" }, { code: "asc" }],
            take,
          }),
        };
      case "recipes":
        return {
          resource,
          data: await this.withRecipeCosting(
            this.prisma,
            await this.prisma.recipe.findMany({
              where: {
                ...where,
                outputItemId: query.outputItemId,
              },
              include: recipeInclude,
              orderBy: [{ updatedAt: "desc" }],
              take,
            }),
          ),
        };
    }
  }

  createCategory(
    dto: CreateCategoryDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withCreateAudit("categories", user, metadata, async (tx) =>
      tx.category.create({ data: { name: this.required(dto.name, "name") } }),
    );
  }

  updateCategory(
    id: string,
    dto: UpdateCategoryDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withUpdateAudit("categories", id, user, metadata, async (tx) =>
      tx.category.update({
        where: { id },
        data: {
          active: dto.active,
          name:
            dto.name === undefined
              ? undefined
              : this.required(dto.name, "name"),
        },
      }),
    );
  }

  createUom(
    dto: CreateUomDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withCreateAudit("uoms", user, metadata, async (tx) =>
      tx.uom.create({
        data: {
          code: this.code(dto.code, "code"),
          name: this.required(dto.name, "name"),
        },
      }),
    );
  }

  updateUom(
    id: string,
    dto: UpdateUomDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withUpdateAudit("uoms", id, user, metadata, async (tx) =>
      tx.uom.update({
        where: { id },
        data: {
          active: dto.active,
          code:
            dto.code === undefined ? undefined : this.code(dto.code, "code"),
          name:
            dto.name === undefined
              ? undefined
              : this.required(dto.name, "name"),
        },
      }),
    );
  }

  async createUomConversion(
    dto: CreateUomConversionDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withCreateAudit(
      "uom-conversions",
      user,
      metadata,
      async (tx) => {
        this.assertDistinctIds(
          dto.fromUomId,
          dto.toUomId,
          "fromUomId and toUomId must be different.",
        );
        await this.assertActive(tx, "uom", dto.fromUomId, "Source UOM");
        await this.assertActive(tx, "uom", dto.toUomId, "Target UOM");

        return tx.uomConversion.create({
          data: {
            factor: new Prisma.Decimal(dto.factor),
            fromUomId: dto.fromUomId,
            toUomId: dto.toUomId,
          },
          include: { fromUom: true, toUom: true },
        });
      },
    );
  }

  async updateUomConversion(
    id: string,
    dto: UpdateUomConversionDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withUpdateAudit(
      "uom-conversions",
      id,
      user,
      metadata,
      async (tx, before) => {
        const fromUomId = dto.fromUomId ?? String(before.fromUomId);
        const toUomId = dto.toUomId ?? String(before.toUomId);
        this.assertDistinctIds(
          fromUomId,
          toUomId,
          "fromUomId and toUomId must be different.",
        );

        if (dto.fromUomId) {
          await this.assertActive(tx, "uom", dto.fromUomId, "Source UOM");
        }

        if (dto.toUomId) {
          await this.assertActive(tx, "uom", dto.toUomId, "Target UOM");
        }

        return tx.uomConversion.update({
          where: { id },
          data: {
            factor:
              dto.factor === undefined
                ? undefined
                : new Prisma.Decimal(dto.factor),
            fromUomId: dto.fromUomId,
            toUomId: dto.toUomId,
          },
          include: { fromUom: true, toUom: true },
        });
      },
    );
  }

  createLocation(
    dto: CreateLocationDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withCreateAudit("locations", user, metadata, async (tx) =>
      tx.location.create({
        data: {
          code: this.code(dto.code, "code"),
          name: this.required(dto.name, "name"),
          type: dto.type,
        },
      }),
    );
  }

  updateLocation(
    id: string,
    dto: UpdateLocationDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withUpdateAudit("locations", id, user, metadata, async (tx) =>
      tx.location.update({
        where: { id },
        data: {
          active: dto.active,
          code:
            dto.code === undefined ? undefined : this.code(dto.code, "code"),
          name:
            dto.name === undefined
              ? undefined
              : this.required(dto.name, "name"),
          type: dto.type,
        },
      }),
    );
  }

  createSupplier(
    dto: CreateSupplierDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withCreateAudit("suppliers", user, metadata, async (tx) =>
      tx.supplier.create({
        data: {
          contactName: this.optionalText(dto.contactName),
          email: this.optionalText(dto.email)?.toLowerCase(),
          name: this.required(dto.name, "name"),
          paymentTerms: this.optionalText(dto.paymentTerms),
          phone: this.optionalText(dto.phone),
        },
      }),
    );
  }

  updateSupplier(
    id: string,
    dto: UpdateSupplierDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withUpdateAudit("suppliers", id, user, metadata, async (tx) =>
      tx.supplier.update({
        where: { id },
        data: {
          active: dto.active,
          contactName:
            dto.contactName === undefined
              ? undefined
              : this.optionalText(dto.contactName),
          email:
            dto.email === undefined
              ? undefined
              : this.optionalText(dto.email)?.toLowerCase(),
          name:
            dto.name === undefined
              ? undefined
              : this.required(dto.name, "name"),
          paymentTerms:
            dto.paymentTerms === undefined
              ? undefined
              : this.optionalText(dto.paymentTerms),
          phone:
            dto.phone === undefined ? undefined : this.optionalText(dto.phone),
        },
      }),
    );
  }

  createReasonCode(
    dto: CreateReasonCodeDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withCreateAudit("reason-codes", user, metadata, async (tx) =>
      tx.reasonCode.create({
        data: {
          code: this.code(dto.code, "code"),
          name: this.required(dto.name, "name"),
          type: dto.type,
        },
      }),
    );
  }

  updateReasonCode(
    id: string,
    dto: UpdateReasonCodeDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withUpdateAudit(
      "reason-codes",
      id,
      user,
      metadata,
      async (tx) =>
        tx.reasonCode.update({
          where: { id },
          data: {
            active: dto.active,
            code:
              dto.code === undefined ? undefined : this.code(dto.code, "code"),
            name:
              dto.name === undefined
                ? undefined
                : this.required(dto.name, "name"),
            type: dto.type,
          },
        }),
    );
  }

  async createItem(
    dto: CreateItemDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withCreateAudit("items", user, metadata, async (tx) => {
      await this.assertActive(tx, "uom", dto.baseUomId, "Base UOM");
      await this.validateLooseItemSetup(tx, dto);

      if (dto.categoryId) {
        await this.assertActive(tx, "category", dto.categoryId, "Category");
      }

      return tx.item.create({
        data: {
          baseUomId: dto.baseUomId,
          categoryId: dto.categoryId,
          itemType: dto.itemType,
          lowStockThreshold:
            dto.lowStockThreshold === undefined
              ? undefined
              : new Prisma.Decimal(dto.lowStockThreshold),
          looseCountEnabled: dto.looseCountEnabled ?? false,
          looseRemainderUomId: dto.looseCountEnabled
            ? dto.looseRemainderUomId
            : null,
          looseWholeUnitQty: dto.looseCountEnabled
            ? new Prisma.Decimal(dto.looseWholeUnitQty!)
            : null,
          looseWholeUomId: dto.looseCountEnabled ? dto.looseWholeUomId : null,
          name: this.required(dto.name, "name"),
          sku: this.code(dto.sku, "sku"),
        },
        include: itemInclude,
      });
    });
  }

  async updateItem(
    id: string,
    dto: UpdateItemDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.withUpdateAudit("items", id, user, metadata, async (tx) => {
      if (dto.baseUomId) {
        await this.assertActive(tx, "uom", dto.baseUomId, "Base UOM");
      }
      await this.validateLooseItemSetup(tx, dto, id);

      if (dto.categoryId) {
        await this.assertActive(tx, "category", dto.categoryId, "Category");
      }

      return tx.item.update({
        where: { id },
        data: {
          active: dto.active,
          baseUomId: dto.baseUomId,
          categoryId: dto.categoryId,
          itemType: dto.itemType,
          lowStockThreshold:
            dto.lowStockThreshold === undefined ||
            dto.lowStockThreshold === null
              ? dto.lowStockThreshold
              : new Prisma.Decimal(dto.lowStockThreshold),
          looseCountEnabled: dto.looseCountEnabled,
          looseRemainderUomId:
            dto.looseCountEnabled === false ? null : dto.looseRemainderUomId,
          looseWholeUnitQty:
            dto.looseWholeUnitQty === undefined ||
            dto.looseWholeUnitQty === null
              ? dto.looseWholeUnitQty
              : new Prisma.Decimal(dto.looseWholeUnitQty),
          looseWholeUomId:
            dto.looseCountEnabled === false ? null : dto.looseWholeUomId,
          name:
            dto.name === undefined
              ? undefined
              : this.required(dto.name, "name"),
          sku: dto.sku === undefined ? undefined : this.code(dto.sku, "sku"),
        },
        include: itemInclude,
      });
    });
  }

  async createRecipe(
    dto: CreateRecipeDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertRecipeWarehouseAccess(user);
    return this.withCreateAudit("recipes", user, metadata, async (tx) => {
      await this.validateRecipeTargets(tx, dto.outputItemId, dto.lines);
      this.assertInitialRecipeCostingReason(dto);
      const now = new Date();

      const recipe = await tx.recipe.create({
        data: {
          active: true,
          outputItemId: dto.outputItemId,
          servingQty: new Prisma.Decimal(dto.servingQty),
          version: dto.version,
          wastageFactor:
            dto.wastageFactor === undefined
              ? undefined
              : new Prisma.Decimal(dto.wastageFactor),
          wastageOverrideApprovedAt:
            dto.wastageFactor === undefined || dto.wastageFactor === 0
              ? undefined
              : now,
          wastageOverrideApprovedById:
            dto.wastageFactor === undefined || dto.wastageFactor === 0
              ? undefined
              : user.id,
          wastageOverrideReason:
            dto.wastageFactor === undefined || dto.wastageFactor === 0
              ? undefined
              : this.required(
                  dto.wastageOverrideReason ?? "",
                  "wastage override reason",
                ),
          wastageOverriddenAt:
            dto.wastageFactor === undefined || dto.wastageFactor === 0
              ? undefined
              : now,
          wastageOverriddenById:
            dto.wastageFactor === undefined || dto.wastageFactor === 0
              ? undefined
              : user.id,
          yieldPercent:
            dto.yieldPercent === undefined
              ? undefined
              : new Prisma.Decimal(dto.yieldPercent),
          yieldOverrideApprovedAt:
            dto.yieldPercent === undefined || dto.yieldPercent === 100
              ? undefined
              : now,
          yieldOverrideApprovedById:
            dto.yieldPercent === undefined || dto.yieldPercent === 100
              ? undefined
              : user.id,
          yieldOverrideReason:
            dto.yieldPercent === undefined || dto.yieldPercent === 100
              ? undefined
              : this.required(
                  dto.yieldOverrideReason ?? "",
                  "yield override reason",
                ),
          yieldOverriddenAt:
            dto.yieldPercent === undefined || dto.yieldPercent === 100
              ? undefined
              : now,
          yieldOverriddenById:
            dto.yieldPercent === undefined || dto.yieldPercent === 100
              ? undefined
              : user.id,
          lines: {
            create: dto.lines.map((line) => ({
              ingredientId: line.ingredientId,
              qty: new Prisma.Decimal(line.qty),
              uomId: line.uomId,
            })),
          },
        },
        include: recipeInclude,
      });

      return this.withOneRecipeCosting(tx, recipe);
    });
  }

  async updateRecipe(
    id: string,
    dto: UpdateRecipeDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertRecipeWarehouseAccess(user);
    return this.withUpdateAudit("recipes", id, user, metadata, async (tx) => {
      const before = await tx.recipe.findUniqueOrThrow({
        where: { id },
        include: { lines: true },
      });

      if (dto.outputItemId || dto.lines) {
        await this.validateRecipeTargets(
          tx,
          dto.outputItemId ?? before.outputItemId,
          dto.lines ?? before.lines,
        );
      }

      const now = new Date();
      const yieldChanged = this.decimalChanged(
        before.yieldPercent,
        dto.yieldPercent,
      );
      const wastageChanged = this.decimalChanged(
        before.wastageFactor,
        dto.wastageFactor,
      );

      if (yieldChanged) {
        this.required(dto.yieldOverrideReason ?? "", "yield override reason");
      }

      if (wastageChanged) {
        this.required(
          dto.wastageOverrideReason ?? "",
          "wastage override reason",
        );
      }

      const recipe = await tx.recipe.update({
        where: { id },
        data: {
          active: dto.active,
          outputItemId: dto.outputItemId,
          servingQty:
            dto.servingQty === undefined
              ? undefined
              : new Prisma.Decimal(dto.servingQty),
          version: dto.version,
          wastageFactor:
            dto.wastageFactor === undefined
              ? undefined
              : new Prisma.Decimal(dto.wastageFactor),
          wastageOverrideApprovedAt: wastageChanged ? now : undefined,
          wastageOverrideApprovedById: wastageChanged ? user.id : undefined,
          wastageOverrideReason: wastageChanged
            ? this.required(
                dto.wastageOverrideReason ?? "",
                "wastage override reason",
              )
            : undefined,
          wastageOverriddenAt: wastageChanged ? now : undefined,
          wastageOverriddenById: wastageChanged ? user.id : undefined,
          yieldPercent:
            dto.yieldPercent === undefined
              ? undefined
              : new Prisma.Decimal(dto.yieldPercent),
          yieldOverrideApprovedAt: yieldChanged ? now : undefined,
          yieldOverrideApprovedById: yieldChanged ? user.id : undefined,
          yieldOverrideReason: yieldChanged
            ? this.required(
                dto.yieldOverrideReason ?? "",
                "yield override reason",
              )
            : undefined,
          yieldOverriddenAt: yieldChanged ? now : undefined,
          yieldOverriddenById: yieldChanged ? user.id : undefined,
          lines:
            dto.lines === undefined
              ? undefined
              : {
                  deleteMany: {},
                  create: dto.lines.map((line) => ({
                    ingredientId: line.ingredientId,
                    qty: new Prisma.Decimal(line.qty),
                    uomId: line.uomId,
                  })),
                },
        },
        include: recipeInclude,
      });

      return this.withOneRecipeCosting(tx, recipe);
    });
  }

  async recordRecipeYieldObservation(
    id: string,
    dto: CreateRecipeYieldObservationDto,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertRecipeWarehouseAccess(user);

    return this.prisma
      .$transaction(async (tx) => {
        const before = await this.requiredRecord(
          await tx.recipe.findUnique({
            where: { id },
            include: recipeInclude,
          }),
          "Recipe",
        );
        const expectedOutputQty = new Prisma.Decimal(dto.expectedOutputQty);
        const actualOutputQty = new Prisma.Decimal(dto.actualOutputQty);
        const computedYieldPercent = actualOutputQty
          .div(expectedOutputQty)
          .mul(100);
        const now = new Date();

        const observation = await tx.recipeYieldObservation.create({
          data: {
            actualOutputQty,
            approvedAt: now,
            approvedById: user.id,
            computedYieldPercent,
            expectedOutputQty,
            notes: this.optionalText(dto.notes),
            observedById: user.id,
            recipeId: id,
          },
        });

        const recipe = await tx.recipe.update({
          where: { id },
          data: {
            yieldOverrideApprovedAt: null,
            yieldOverrideApprovedById: null,
            yieldOverrideReason: null,
            yieldOverriddenAt: null,
            yieldOverriddenById: null,
            yieldPercent: computedYieldPercent,
          },
          include: recipeInclude,
        });

        const after = await this.withOneRecipeCosting(tx, recipe);

        await this.recordAudit(
          tx,
          "recipes",
          "yield-observation",
          resourceConfig.recipes.entityType,
          id,
          user,
          metadata,
          before,
          { observation, recipe: after },
        );

        return { status: "recorded", data: after };
      })
      .catch((error) => this.handlePrismaError(error));
  }

  deactivateRecipe(
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    this.assertRecipeWarehouseAccess(user);
    return this.deactivate("recipes", id, user, metadata);
  }

  async deactivate(
    resource: MasterDataResource,
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata = {},
  ) {
    return this.prisma
      .$transaction(async (tx) => {
        const before = await this.findExisting(tx, resource, id);
        const config = resourceConfig[resource];
        if (resource === "uom-conversions") {
          const after = await tx.uomConversion.delete({ where: { id } });

          await this.recordAudit(
            tx,
            resource,
            "deactivate",
            config.entityType,
            id,
            user,
            metadata,
            before,
            after,
          );

          return {
            status: "removed",
            data: after,
          };
        }

        const after = await this.updateActive(tx, resource, id, false);

        await this.recordAudit(
          tx,
          resource,
          "deactivate",
          config.entityType,
          id,
          user,
          metadata,
          before,
          after,
        );

        return {
          status: "deactivated",
          data: after,
        };
      })
      .catch((error) => this.handlePrismaError(error));
  }

  private async withCreateAudit<T extends { id: string }>(
    resource: MasterDataResource,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
    create: (tx: Tx) => Promise<T>,
  ) {
    return this.prisma
      .$transaction(async (tx) => {
        const data = await create(tx);
        await this.recordAudit(
          tx,
          resource,
          "create",
          resourceConfig[resource].entityType,
          data.id,
          user,
          metadata,
          null,
          data,
        );

        return { status: "created", data };
      })
      .catch((error) => this.handlePrismaError(error));
  }

  private async withUpdateAudit<T extends { id: string }>(
    resource: MasterDataResource,
    id: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
    update: (tx: Tx, before: T & Record<string, unknown>) => Promise<T>,
  ) {
    return this.prisma
      .$transaction(async (tx) => {
        const before = (await this.findExisting(
          tx,
          resource,
          id,
        )) as unknown as T & Record<string, unknown>;
        const data = await update(tx, before as T & Record<string, unknown>);
        await this.recordAudit(
          tx,
          resource,
          "update",
          resourceConfig[resource].entityType,
          id,
          user,
          metadata,
          before,
          data,
        );

        return { status: "updated", data };
      })
      .catch((error) => this.handlePrismaError(error));
  }

  private async recordAudit(
    tx: Tx,
    resource: MasterDataResource,
    action: string,
    entityType: string,
    entityId: string,
    user: AuthenticatedUser,
    metadata: RequestAuditMetadata,
    before: unknown,
    after: unknown,
  ) {
    await tx.auditLog.create({
      data: {
        action: `${resource}.${action}`,
        after: this.toAuditJson(after),
        before: this.toAuditJson(before),
        entityId,
        entityType,
        ipAddress: metadata.ipAddress,
        module: "master-data",
        userAgent: metadata.userAgent,
        userId: user.id,
      },
    });
  }

  private async findExisting(tx: Tx, resource: MasterDataResource, id: string) {
    switch (resource) {
      case "categories":
        return this.requiredRecord(
          await tx.category.findUnique({ where: { id } }),
          "Category",
        );
      case "items":
        return this.requiredRecord(
          await tx.item.findUnique({
            where: { id },
            include: { baseUom: true, category: true },
          }),
          "Item",
        );
      case "locations":
        return this.requiredRecord(
          await tx.location.findUnique({ where: { id } }),
          "Location",
        );
      case "reason-codes":
        return this.requiredRecord(
          await tx.reasonCode.findUnique({ where: { id } }),
          "Reason code",
        );
      case "recipes":
        return this.requiredRecord(
          await tx.recipe.findUnique({
            where: { id },
            include: {
              outputItem: { include: { baseUom: true } },
              lines: { include: { ingredient: true, uom: true } },
            },
          }),
          "Recipe",
        );
      case "suppliers":
        return this.requiredRecord(
          await tx.supplier.findUnique({ where: { id } }),
          "Supplier",
        );
      case "uom-conversions":
        return this.requiredRecord(
          await tx.uomConversion.findUnique({
            where: { id },
            include: { fromUom: true, toUom: true },
          }),
          "UOM conversion",
        );
      case "uoms":
        return this.requiredRecord(
          await tx.uom.findUnique({ where: { id } }),
          "UOM",
        );
    }
  }

  private updateActive(
    tx: Tx,
    resource: Exclude<MasterDataResource, "uom-conversions">,
    id: string,
    active: boolean,
  ) {
    switch (resource) {
      case "categories":
        return tx.category.update({ where: { id }, data: { active } });
      case "items":
        return tx.item.update({
          where: { id },
          data: { active },
          include: { baseUom: true, category: true },
        });
      case "locations":
        return tx.location.update({ where: { id }, data: { active } });
      case "reason-codes":
        return tx.reasonCode.update({ where: { id }, data: { active } });
      case "recipes":
        return tx.recipe.update({
          where: { id },
          data: { active },
          include: {
            outputItem: { include: { baseUom: true } },
            lines: { include: { ingredient: true, uom: true } },
          },
        });
      case "suppliers":
        return tx.supplier.update({ where: { id }, data: { active } });
      case "uoms":
        return tx.uom.update({ where: { id }, data: { active } });
    }
  }

  private async withRecipeCosting<T extends { lines: unknown[] }>(
    tx: Tx | PrismaService,
    recipes: T[],
  ) {
    return Promise.all(
      recipes.map((recipe) => this.withOneRecipeCosting(tx, recipe)),
    );
  }

  private async withOneRecipeCosting<T extends { lines: unknown[] }>(
    tx: Tx | PrismaService,
    recipe: T,
  ) {
    const costing = await this.calculateRecipeCost(tx, recipe);
    return { ...recipe, ...costing };
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
        relatedSkuOrName(ingredient),
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
          `${relatedSkuOrName(ingredient)} has no moving average or supplier cost.`,
        );
      }

      totalRecipeCost = totalRecipeCost.add(adjustedQty.mul(unitCost));
    }

    const usableServingQty = decimalValue(recipe.servingQty).mul(
      decimalValue(recipe.yieldPercent, "100").div(100),
    );
    const costPerServing = usableServingQty.gt(0)
      ? totalRecipeCost.div(usableServingQty)
      : new Prisma.Decimal(0);

    return {
      costPerServing: costPerServing.toFixed(6),
      costingWarnings,
      totalRecipeCost: totalRecipeCost.toFixed(6),
      usableServingQty: usableServingQty.toFixed(6),
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

  private assertRecipeWarehouseAccess(user: AuthenticatedUser) {
    if (
      user.role.code !== RoleCode.ADMIN &&
      user.role.code !== RoleCode.WAREHOUSE_MANAGER
    ) {
      throw new ForbiddenException(
        "Only warehouse or HQ users can change recipes.",
      );
    }
  }

  private assertInitialRecipeCostingReason(dto: CreateRecipeDto) {
    if (dto.yieldPercent !== undefined && dto.yieldPercent !== 100) {
      this.required(dto.yieldOverrideReason ?? "", "yield override reason");
    }

    if (dto.wastageFactor !== undefined && dto.wastageFactor > 0) {
      this.required(dto.wastageOverrideReason ?? "", "wastage override reason");
    }
  }

  private decimalChanged(current: Prisma.Decimal, next?: number) {
    return next !== undefined && !current.equals(new Prisma.Decimal(next));
  }

  private async validateRecipeTargets(
    tx: Tx,
    outputItemId: string,
    lines: Array<{ ingredientId: string; uomId: string }>,
  ) {
    await this.assertActive(tx, "item", outputItemId, "Output item");

    for (const line of lines) {
      this.assertDistinctIds(
        outputItemId,
        line.ingredientId,
        "Recipe output item cannot also be an ingredient.",
      );
      await this.assertActive(tx, "item", line.ingredientId, "Ingredient item");
      await this.assertActive(tx, "uom", line.uomId, "Ingredient UOM");
      await this.assertRecipeLineConversion(tx, line.ingredientId, line.uomId);
    }
  }

  private async assertRecipeLineConversion(
    tx: Tx,
    ingredientId: string,
    uomId: string,
  ) {
    const ingredient = await tx.item.findUnique({
      where: { id: ingredientId },
      select: { baseUomId: true, sku: true },
    });

    if (!ingredient || ingredient.baseUomId === uomId) {
      return;
    }

    const conversion = await tx.uomConversion.findUnique({
      where: {
        fromUomId_toUomId: {
          fromUomId: uomId,
          toUomId: ingredient.baseUomId,
        },
      },
      select: { id: true },
    });

    if (!conversion) {
      throw new BadRequestException(
        `Missing UOM conversion from recipe UOM to base UOM for ${ingredient.sku}.`,
      );
    }
  }

  private async validateLooseItemSetup(
    tx: Tx,
    dto: CreateItemDto | UpdateItemDto,
    itemId?: string,
  ) {
    if (dto.looseCountEnabled === false) {
      return;
    }

    if (dto.looseCountEnabled !== true && !itemId) {
      return;
    }

    const existing = itemId
      ? await tx.item.findUnique({
          where: { id: itemId },
          select: {
            looseCountEnabled: true,
            looseRemainderUomId: true,
            looseWholeUnitQty: true,
            looseWholeUomId: true,
          },
        })
      : null;

    const looseCountEnabled =
      dto.looseCountEnabled ?? existing?.looseCountEnabled ?? false;

    if (!looseCountEnabled) {
      return;
    }

    const looseWholeUomId = dto.looseWholeUomId ?? existing?.looseWholeUomId;
    const looseRemainderUomId =
      dto.looseRemainderUomId ?? existing?.looseRemainderUomId;
    const looseWholeUnitQty =
      dto.looseWholeUnitQty ?? existing?.looseWholeUnitQty?.toNumber();

    if (!looseWholeUomId || !looseRemainderUomId || !looseWholeUnitQty) {
      throw new BadRequestException(
        "Loose-count items require whole UOM, loose UOM, and whole-unit quantity.",
      );
    }

    await this.assertActive(tx, "uom", looseWholeUomId, "Loose whole UOM");
    await this.assertActive(
      tx,
      "uom",
      looseRemainderUomId,
      "Loose remainder UOM",
    );
  }

  private async assertActive(
    tx: Tx,
    model: "category" | "item" | "uom",
    id: string,
    label: string,
  ) {
    const record =
      model === "category"
        ? await tx.category.findFirst({
            where: { id, active: true },
            select: { id: true },
          })
        : model === "item"
          ? await tx.item.findFirst({
              where: { id, active: true },
              select: { id: true },
            })
          : await tx.uom.findFirst({
              where: { id, active: true },
              select: { id: true },
            });

    if (!record) {
      throw new BadRequestException(`${label} must exist and be active.`);
    }
  }

  private requiredRecord<T>(record: T | null, label: string) {
    if (!record) {
      throw new NotFoundException(`${label} not found.`);
    }

    return record;
  }

  private required(value: string, label: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      throw new BadRequestException(`${label} is required.`);
    }

    return trimmed;
  }

  private optionalText(value?: string) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private code(value: string, label: string) {
    return this.required(value, label).toUpperCase().replace(/\s+/g, "-");
  }

  private assertDistinctIds(left: string, right: string, message: string) {
    if (left === right) {
      throw new BadRequestException(message);
    }
  }

  private listWhere(query: Record<string, string>) {
    if (query.active === undefined) {
      return {};
    }

    return { active: query.active === "true" };
  }

  private search(search: string | undefined, fields: string[]) {
    const term = search?.trim();

    if (!term) {
      return undefined;
    }

    return fields.map((field) => ({
      [field]: { contains: term, mode: Prisma.QueryMode.insensitive },
    }));
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

  private toAuditJson(value: unknown) {
    if (value === null || value === undefined) {
      return undefined;
    }

    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private handlePrismaError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException
    ) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ConflictException(
          "A master data record with the same unique value already exists.",
        );
      }

      if (error.code === "P2003") {
        throw new BadRequestException(
          "Related master data record was not found.",
        );
      }
    }

    throw error;
  }
}
