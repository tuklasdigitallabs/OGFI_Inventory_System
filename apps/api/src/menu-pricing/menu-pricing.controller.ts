import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { CreateMenuPriceDto, UpdateMenuPriceDto } from "./dto/menu-pricing.dto";
import { MenuPricingService } from "./menu-pricing.service";

@Controller("menu-pricing")
export class MenuPricingController {
  constructor(private readonly menuPricingService: MenuPricingService) {}

  @Get()
  @Permissions("menu-pricing:read")
  list(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuPricingService.list(query, user);
  }

  @Post()
  @Permissions("menu-pricing:create")
  create(
    @Body() body: CreateMenuPriceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuPricingService.create(body, user);
  }

  @Patch(":id")
  @Permissions("menu-pricing:create")
  update(
    @Param("id") id: string,
    @Body() body: UpdateMenuPriceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.menuPricingService.update(id, body, user);
  }

  @Post(":id/submit")
  @Permissions("menu-pricing:create")
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.menuPricingService.submit(id, user);
  }

  @Post(":id/clone")
  @Permissions("menu-pricing:create")
  clone(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.menuPricingService.cloneToDraft(id, user);
  }

  @Post(":id/approve")
  @Permissions("menu-pricing:approve")
  approve(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.menuPricingService.approve(id, user);
  }
}
