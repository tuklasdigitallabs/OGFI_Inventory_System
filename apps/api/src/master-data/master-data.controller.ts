import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { MasterDataService } from './master-data.service';

@Controller('admin')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('items')
  listItems(@Query() query: Record<string, string>) {
    return this.masterDataService.list('items', query);
  }

  @Post('items')
  createItem(@Body() body: unknown) {
    return this.masterDataService.action('items.create', body);
  }

  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Body() body: unknown) {
    return this.masterDataService.action('items.update', { id, body });
  }

  @Get('uoms')
  listUoms() {
    return this.masterDataService.list('uoms');
  }

  @Post('uoms')
  createUom(@Body() body: unknown) {
    return this.masterDataService.action('uoms.create', body);
  }

  @Post('uom-conversions')
  createUomConversion(@Body() body: unknown) {
    return this.masterDataService.action('uom-conversions.create', body);
  }

  @Get('suppliers')
  listSuppliers(@Query() query: Record<string, string>) {
    return this.masterDataService.list('suppliers', query);
  }

  @Post('suppliers')
  createSupplier(@Body() body: unknown) {
    return this.masterDataService.action('suppliers.create', body);
  }

  @Get('recipes')
  listRecipes(@Query() query: Record<string, string>) {
    return this.masterDataService.list('recipes', query);
  }

  @Post('recipes')
  createRecipe(@Body() body: unknown) {
    return this.masterDataService.action('recipes.create', body);
  }

  @Patch('recipes/:id')
  updateRecipe(@Param('id') id: string, @Body() body: unknown) {
    return this.masterDataService.action('recipes.update', { id, body });
  }

  @Get('locations')
  listLocations(@Query() query: Record<string, string>) {
    return this.masterDataService.list('locations', query);
  }

  @Post('locations')
  createLocation(@Body() body: unknown) {
    return this.masterDataService.action('locations.create', body);
  }
}
