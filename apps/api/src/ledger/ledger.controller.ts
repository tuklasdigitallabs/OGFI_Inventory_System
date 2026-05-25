import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types';
import { LocationAccess } from '../rbac/decorators/location-access.decorator';
import { Permissions } from '../rbac/decorators/permissions.decorator';
import {
  CreateAdjustmentRequestDto,
  RejectAdjustmentRequestDto,
} from './dto/adjustment-request.dto';
import { PostLedgerEventDto } from './dto/post-ledger-event.dto';
import { ReverseLedgerEventDto } from './dto/reverse-ledger-event.dto';
import { LedgerService } from './ledger.service';
import { OpeningInventoryImportService } from './opening-inventory-import.service';

const importFileMaxSizeBytes = 5 * 1024 * 1024;
const xlsxMimeType =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type UploadedWorkbook = {
  buffer?: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

@Controller()
export class LedgerController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly openingInventoryImportService: OpeningInventoryImportService,
  ) {}

  @Get('inventory/stock-on-hand')
  @Permissions('inventory.stock:read')
  @LocationAccess({ source: 'query', key: 'locationId' })
  stockOnHand(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ledgerService.list('inventory.stock-on-hand', query, user);
  }

  @Get('inventory/movements')
  @Permissions('inventory.movements:read')
  @LocationAccess({ source: 'query', key: 'locationId' })
  movements(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ledgerService.list('inventory.movements', query, user);
  }

  @Get('inventory/adjustment-requests')
  @Permissions('inventory.adjustments:read')
  @LocationAccess({ source: 'query', key: 'locationId' })
  adjustmentRequests(
    @Query() query: Record<string, string>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ledgerService.list(
      'inventory.adjustment-requests',
      query,
      user,
    );
  }

  @Post('inventory/opening-inventory/import')
  @Permissions('ledger.events:post')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: importFileMaxSizeBytes } }),
  )
  importOpeningInventory(
    @UploadedFile() file: UploadedWorkbook | undefined,
    @Body() body: { businessDate: string; locationId: string },
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    if (!file?.buffer) {
      return {
        errorReportBase64: null,
        errorReportFilename: null,
        errors: [
          {
            errors: ['Upload an .xlsx file.'],
            row: 0,
            sheet: 'Opening Inventory',
            values: {},
          },
        ],
        failed: 1,
        imported: 0,
        posted: false,
        stockCountNumber: null,
      };
    }

    this.assertXlsxUpload(file);

    return this.openingInventoryImportService.importWorkbook(
      file.buffer,
      body,
      user,
      {
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );
  }

  @Post('inventory/adjustment-requests')
  @Permissions('inventory.adjustments:create')
  @LocationAccess({ source: 'body', key: 'locationId' })
  createAdjustmentRequest(
    @Body() body: CreateAdjustmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.ledgerService.createAdjustmentRequest(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('inventory/adjustment-requests/:id/approve')
  @Permissions('inventory.adjustments:approve')
  approveAdjustmentRequest(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.ledgerService.approveAdjustmentRequest(id, user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('inventory/adjustment-requests/:id/reject')
  @Permissions('inventory.adjustments:approve')
  rejectAdjustmentRequest(
    @Param('id') id: string,
    @Body() body: RejectAdjustmentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.ledgerService.rejectAdjustmentRequest(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('ledger/events')
  @Permissions('ledger.events:post')
  @LocationAccess({ source: 'body', key: 'locationId' })
  postEvent(
    @Body() body: PostLedgerEventDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.ledgerService.postEvent(body, user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('ledger/events/:id/reversal')
  @Permissions('ledger.events:post')
  reverseEvent(
    @Param('id') id: string,
    @Body() body: ReverseLedgerEventDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.ledgerService.reverseEvent(id, body, user, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Get('ledger/events/:id')
  @Permissions('ledger.events:read')
  getEvent(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.ledgerService.list('ledger.events.detail', { id }, user);
  }

  private assertXlsxUpload(file: UploadedWorkbook) {
    const hasXlsxExtension = file.originalname?.toLowerCase().endsWith('.xlsx');

    if (file.size && file.size > importFileMaxSizeBytes) {
      throw new BadRequestException('Upload file must be 5 MB or smaller.');
    }

    if (file.mimetype !== xlsxMimeType || !hasXlsxExtension) {
      throw new BadRequestException('Upload a valid .xlsx workbook.');
    }
  }
}
