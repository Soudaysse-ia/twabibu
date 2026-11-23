import { DynamicModule, Module } from '@nestjs/common';
import { FIELD_CRYPTO, FieldCrypto } from '../common/field-crypto.js';
import type { AppConfig } from '../config.js';
import { AdminAuthService } from './admin-auth.service.js';
import { AdminPharmaciesService } from './admin-pharmacies.service.js';
import { AdminReportsService } from './admin-reports.service.js';
import { AdminReferentialsService } from './admin-referentials.service.js';
import { AdminAuthController, AdminController, AdminReferentialsController } from './admin.controller.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';
import { AuditService } from './audit.service.js';

/** SPEC-11 back-office API (/v1/admin). Separate app: apps/admin. */
@Module({})
export class AdminModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AdminModule,
      controllers: [AdminAuthController, AdminController, AdminReferentialsController],
      providers: [{ provide: FIELD_CRYPTO, useValue: new FieldCrypto(config.ENCRYPTION_KEY) }, AdminAuthService, AdminService, AdminPharmaciesService, AdminReferentialsService, AdminReportsService, AuditService, AdminGuard],
    };
  }
}
