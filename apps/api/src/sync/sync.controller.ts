import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types";
import { LocationAccess } from "../rbac/decorators/location-access.decorator";
import { Permissions } from "../rbac/decorators/permissions.decorator";
import { SubmitSyncBatchDto } from "./dto/sync.dto";
import { SyncService } from "./sync.service";

@Controller("sync")
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get("bootstrap")
  @Permissions("sync:read")
  bootstrap(@CurrentUser() user: AuthenticatedUser) {
    return this.syncService.bootstrap(user);
  }

  @Get("status")
  @Permissions("sync:read")
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.syncService.status(user);
  }

  @Post("batch")
  @Permissions("sync:submit")
  @LocationAccess({ source: "body", key: "locationId" })
  submitBatch(
    @Body() body: SubmitSyncBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.syncService.submitBatch(body, user);
  }

  @Get("batches/:id")
  @Permissions("sync:read")
  getBatch(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.syncService.getBatch(id, user);
  }

  @Get("batches")
  @Permissions("sync:read")
  listBatches(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.syncService.listBatches(query, user);
  }
}
