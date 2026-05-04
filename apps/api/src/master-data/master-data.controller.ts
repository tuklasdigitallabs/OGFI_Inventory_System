import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { MasterDataService } from './master-data.service';

@Controller('admin')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('items')
  @Permissions('master-data.items:read')
  listItems(@Query() query: Record<string, string>) {
    return this.masterDataService.list('items', query);
  }

  @Post('items')
  @Permissions('master-data.items:create')
  createItem(@Body() body: unknown) {
    return this.masterDataService.action('items.create', body);
  }

  @Patch('items/:id')
  @Permissions('master-data.items:update')
  updateItem(@Param('id') id: string, @Body() body: unknown) {
    return this.masterDataService.action('items.update', { id, body });
  }

  @Get('uoms')
  @Permissions('master-data.uoms:read')
  listUoms() {
    return this.masterDataService.list('uoms');
  }

  @Post('uoms')
  @Permissions('master-data.uoms:create')
  createUom(@Body() body: unknown) {
    return this.masterDataService.action('uoms.create', body);
  }

  @Post('uom-conversions')
  @Permissions('master-data.uoms:create')
  createUomConversion(@Body() body: unknown) {
    return this.masterDataService.action('uom-conversions.create', body);
  }

  @Get('suppliers')
  @Permissions('master-data.suppliers:read')
  listSuppliers(@Query() query: Record<string, string>) {
    return this.masterDataService.list('suppliers', query);
  }

  @Post('suppliers')
  @Permissions('master-data.suppliers:create')
  createSupplier(@Body() body: unknown) {
    return this.masterDataService.action('suppliers.create', body);
  }

  @Get('recipes')
  @Permissions('master-data.items:read')
  listRecipes(@Query() query: Record<string, string>) {
    return this.masterDataService.list('recipes', query);
  }

  @Post('recipes')
  @Permissions('master-data.items:create')
  createRecipe(@Body() body: unknown) {
    return this.masterDataService.action('recipes.create', body);
  }

  @Patch('recipes/:id')
  @Permissions('master-data.items:update')
  updateRecipe(@Param('id') id: string, @Body() body: unknown) {
    return this.masterDataService.action('recipes.update', { id, body });
  }

  @Get('locations')
  @Permissions('master-data.locations:read')
  listLocations(@Query() query: Record<string, string>) {
    return this.masterDataService.list('locations', query);
  }

  @Post('locations')
  @Permissions('master-data.locations:create')
  createLocation(@Body() body: unknown) {
    return this.masterDataService.action('locations.create', body);
  }
}
