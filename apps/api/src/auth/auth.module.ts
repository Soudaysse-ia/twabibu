import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard, PatientGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({ controllers: [AuthController], providers: [AuthService, AuthGuard, PatientGuard], exports: [AuthService, AuthGuard, PatientGuard] })
export class AuthModule {}
