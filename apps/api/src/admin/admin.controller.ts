import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Permissions('admin.users:read')
  listUsers(@Query() query: Record<string, string>) {
    return this.adminService.list('users', query);
  }

  @Post('users')
  @Permissions('admin.users:create')
  createUser(@Body() body: unknown) {
    return this.adminService.action('users.create', body);
  }

  @Patch('users/:id')
  @Permissions('admin.users:update')
  updateUser(@Param('id') id: string, @Body() body: unknown) {
    return this.adminService.action('users.update', { id, body });
  }

  @Post('users/:id/deactivate')
  @Permissions('admin.users:deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.adminService.action('users.deactivate', { id });
  }

  @Get('roles')
  @Permissions('admin.roles:read')
  listRoles() {
    return this.adminService.list('roles');
  }

  @Post('roles')
  @Permissions('admin.roles:update')
  createRole(@Body() body: unknown) {
    return this.adminService.action('roles.create', body);
  }

  @Patch('roles/:id')
  @Permissions('admin.roles:update')
  updateRole(@Param('id') id: string, @Body() body: unknown) {
    return this.adminService.action('roles.update', { id, body });
  }

  @Get('permissions')
  @Permissions('admin.roles:read')
  listPermissions() {
    return this.adminService.list('permissions');
  }

  @Get('audit-logs')
  @Permissions('admin.audit:read')
  searchAuditLogs(@Query() query: Record<string, string>) {
    return this.adminService.list('audit-logs', query);
  }
}
