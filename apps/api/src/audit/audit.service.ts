import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  record(module: string, action: string, payload: unknown) {
    return {
      module,
      action,
      payload,
      status: 'audit_scaffolded',
    };
  }
}
