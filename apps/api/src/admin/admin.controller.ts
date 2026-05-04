import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  listUsers(@Query() query: Record<string, string>) {
    return this.adminService.list('users', query);
  }

  @Post('users')
  createUser(@Body() body: unknown) {
    return this.adminService.action('users.create', body);
  }

  @Patch('users/:id')
  updateUser(@Param('id') id: string, @Body() body: unknown) {
    return this.adminService.action('users.update', { id, body });
  }

  @Post('users/:id/deactivate')
  deactivateUser(@Param('id') id: string) {
    return this.adminService.action('users.deactivate', { id });
  }

  @Get('roles')
  listRoles() {
    return this.adminService.list('roles');
  }

  @Post('roles')
  createRole(@Body() body: unknown) {
    return this.adminService.action('roles.create', body);
  }

  @Patch('roles/:id')
  updateRole(@Param('id') id: string, @Body() body: unknown) {
    return this.adminService.action('roles.update', { id, body });
  }

  @Get('permissions')
  listPermissions() {
    return this.adminService.list('permissions');
  }

  @Get('audit-logs')
  searchAuditLogs(@Query() query: Record<string, string>) {
    return this.adminService.list('audit-logs', query);
  }
}
