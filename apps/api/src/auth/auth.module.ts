import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthGuard, PatientGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { ProSignupService } from '../pro/pro-signup.service.js';

@Global()
@Module({ controllers: [AuthController], providers: [AuthService, ProSignupService, AuthGuard, PatientGuard], exports: [AuthService, AuthGuard, PatientGuard] })
export class AuthModule {}
