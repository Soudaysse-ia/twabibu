import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { PharmaGuard } from './pharma.guard.js';
import { PharmaService } from './pharma.service.js';
import { PatientOrdersController, PharmaController, PharmaMeController, PublicPharmaciesController } from './pharmacies.controller.js';
import { PharmaciesService } from './pharmacies.service.js';

/** SPEC-15: public directory and duty pharmacies, patient orders, Twabibu Pharma. */
@Module({
  controllers: [PublicPharmaciesController, PatientOrdersController, PharmaMeController, PharmaController],
  providers: [PharmaciesService, OrdersService, PharmaService, PharmaGuard],
})
export class PharmaciesModule {}
