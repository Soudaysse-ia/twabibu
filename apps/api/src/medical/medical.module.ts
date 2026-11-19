import { DynamicModule, Module } from '@nestjs/common';
import type { AppConfig } from '../config.js';
import { FIELD_CRYPTO, FieldCrypto } from '../common/field-crypto.js';
import { ProGuard } from '../pro/pro.guard.js';
import { ConsentsService } from './consents.service.js';
import { MedicalAccessService } from './medical-access.service.js';
import { MedicalController, PatientMedicalController, PracticePrescriptionsController, PublicMedicalController } from './medical.controller.js';
import { MedicalService } from './medical.service.js';
import { PrescriptionsService } from './prescriptions.service.js';

@Module({})
export class MedicalModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: MedicalModule,
      controllers: [MedicalController, PracticePrescriptionsController, PublicMedicalController, PatientMedicalController],
      providers: [
        { provide: FIELD_CRYPTO, useValue: new FieldCrypto(config.ENCRYPTION_KEY) },
        MedicalAccessService,
        MedicalService,
        PrescriptionsService,
        ConsentsService,
        ProGuard,
      ],
    };
  }
}
