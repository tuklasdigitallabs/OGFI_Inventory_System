import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Request, Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types";
import { Permissions } from "../rbac/decorators/permissions.decorator";
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
import { MasterDataImportService } from "./master-data-import.service";
import { MasterDataService } from "./master-data.service";

@Controller("admin")
export class MasterDataController {
  constructor(
    private readonly masterDataImportService: MasterDataImportService,
    private readonly masterDataService: MasterDataService,
  ) {}

  @Get("master-data/import-template")
  @Permissions(
    "master-data.items:read",
    "master-data.uoms:read",
    "master-data.uom-conversions:read",
    "master-data.suppliers:read",
    "master-data.locations:read",
    "master-data.categories:read",
    "master-data.reason-codes:read",
    "master-data.recipes:read",
  )
  async downloadImportTemplate(@Res() response: Response) {
    const buffer = await this.masterDataImportService.templateWorkbook();
    response.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    response.setHeader(
      "Content-Disposition",
      'attachment; filename="OGFI_Master_Data_Template.xlsx"',
    );
    response.send(buffer);
  }

  @Post("master-data/import")
  @Permissions(
    "master-data.items:create",
    "master-data.items:update",
    "master-data.uoms:create",
    "master-data.uoms:update",
    "master-data.uom-conversions:create",
    "master-data.uom-conversions:update",
    "master-data.suppliers:create",
    "master-data.suppliers:update",
    "master-data.locations:create",
    "master-data.locations:update",
    "master-data.categories:create",
    "master-data.categories:update",
    "master-data.reason-codes:create",
    "master-data.reason-codes:update",
    "master-data.recipes:create",
    "master-data.recipes:update",
  )
  @UseInterceptors(FileInterceptor("file"))
  importMasterData(
    @UploadedFile() file: { buffer?: Buffer } | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (!file?.buffer) {
      return {
        created: 0,
        errorReportBase64: null,
        errorReportFilename: null,
        errors: [
          {
            errors: ["Upload an .xlsx file."],
            row: 0,
            sheet: "Instructions",
            values: {},
          },
        ],
        failed: 1,
        imported: 0,
        updated: 0,
      };
    }

    return this.masterDataImportService.importWorkbook(
      file.buffer,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("items")
  @Permissions("master-data.items:read")
  listItems(@Query() query: Record<string, string>) {
    return this.masterDataService.list("items", query);
  }

  @Post("items")
  @Permissions("master-data.items:create")
  createItem(
    @Body() body: CreateItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.createItem(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("items/:id")
  @Permissions("master-data.items:update")
  updateItem(
    @Param("id") id: string,
    @Body() body: UpdateItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.updateItem(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("items/:id/deactivate")
  @Permissions("master-data.items:deactivate")
  deactivateItem(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.deactivate(
      "items",
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("uoms")
  @Permissions("master-data.uoms:read")
  listUoms(@Query() query: Record<string, string>) {
    return this.masterDataService.list("uoms", query);
  }

  @Post("uoms")
  @Permissions("master-data.uoms:create")
  createUom(
    @Body() body: CreateUomDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.createUom(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("uoms/:id")
  @Permissions("master-data.uoms:update")
  updateUom(
    @Param("id") id: string,
    @Body() body: UpdateUomDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.updateUom(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("uoms/:id/deactivate")
  @Permissions("master-data.uoms:deactivate")
  deactivateUom(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.deactivate(
      "uoms",
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("uom-conversions")
  @Permissions("master-data.uom-conversions:read")
  listUomConversions(@Query() query: Record<string, string>) {
    return this.masterDataService.list("uom-conversions", query);
  }

  @Post("uom-conversions")
  @Permissions("master-data.uom-conversions:create")
  createUomConversion(
    @Body() body: CreateUomConversionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.createUomConversion(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("uom-conversions/:id")
  @Permissions("master-data.uom-conversions:update")
  updateUomConversion(
    @Param("id") id: string,
    @Body() body: UpdateUomConversionDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.updateUomConversion(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("uom-conversions/:id/deactivate")
  @Permissions("master-data.uom-conversions:deactivate")
  deactivateUomConversion(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.deactivate(
      "uom-conversions",
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("suppliers")
  @Permissions("master-data.suppliers:read")
  listSuppliers(@Query() query: Record<string, string>) {
    return this.masterDataService.list("suppliers", query);
  }

  @Post("suppliers")
  @Permissions("master-data.suppliers:create")
  createSupplier(
    @Body() body: CreateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.createSupplier(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("suppliers/:id")
  @Permissions("master-data.suppliers:update")
  updateSupplier(
    @Param("id") id: string,
    @Body() body: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.updateSupplier(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("suppliers/:id/deactivate")
  @Permissions("master-data.suppliers:deactivate")
  deactivateSupplier(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.deactivate(
      "suppliers",
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("categories")
  @Permissions("master-data.categories:read")
  listCategories(@Query() query: Record<string, string>) {
    return this.masterDataService.list("categories", query);
  }

  @Post("categories")
  @Permissions("master-data.categories:create")
  createCategory(
    @Body() body: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.createCategory(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("categories/:id")
  @Permissions("master-data.categories:update")
  updateCategory(
    @Param("id") id: string,
    @Body() body: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.updateCategory(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("categories/:id/deactivate")
  @Permissions("master-data.categories:deactivate")
  deactivateCategory(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.deactivate(
      "categories",
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("reason-codes")
  @Permissions("master-data.reason-codes:read")
  listReasonCodes(@Query() query: Record<string, string>) {
    return this.masterDataService.list("reason-codes", query);
  }

  @Post("reason-codes")
  @Permissions("master-data.reason-codes:create")
  createReasonCode(
    @Body() body: CreateReasonCodeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.createReasonCode(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("reason-codes/:id")
  @Permissions("master-data.reason-codes:update")
  updateReasonCode(
    @Param("id") id: string,
    @Body() body: UpdateReasonCodeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.updateReasonCode(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("reason-codes/:id/deactivate")
  @Permissions("master-data.reason-codes:deactivate")
  deactivateReasonCode(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.deactivate(
      "reason-codes",
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("recipes")
  @Permissions("master-data.recipes:read")
  listRecipes(@Query() query: Record<string, string>) {
    return this.masterDataService.list("recipes", query);
  }

  @Post("recipes")
  @Permissions("master-data.recipes:create")
  createRecipe(
    @Body() body: CreateRecipeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.createRecipe(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("recipes/:id")
  @Permissions("master-data.recipes:update")
  updateRecipe(
    @Param("id") id: string,
    @Body() body: UpdateRecipeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.updateRecipe(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("recipes/:id/deactivate")
  @Permissions("master-data.recipes:deactivate")
  deactivateRecipe(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.deactivateRecipe(
      id,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("recipes/:id/yield-observations")
  @Permissions("master-data.recipes:update")
  createRecipeYieldObservation(
    @Param("id") id: string,
    @Body() body: CreateRecipeYieldObservationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.recordRecipeYieldObservation(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Get("locations")
  @Permissions("master-data.locations:read")
  listLocations(@Query() query: Record<string, string>) {
    return this.masterDataService.list("locations", query);
  }

  @Post("locations")
  @Permissions("master-data.locations:create")
  createLocation(
    @Body() body: CreateLocationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.createLocation(
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Patch("locations/:id")
  @Permissions("master-data.locations:update")
  updateLocation(
    @Param("id") id: string,
    @Body() body: UpdateLocationDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.updateLocation(
      id,
      body,
      user,
      this.auditMetadata(request),
    );
  }

  @Post("locations/:id/deactivate")
  @Permissions("master-data.locations:deactivate")
  deactivateLocation(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.masterDataService.deactivate(
      "locations",
      id,
      user,
      this.auditMetadata(request),
    );
  }

  private auditMetadata(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };
  }
}
