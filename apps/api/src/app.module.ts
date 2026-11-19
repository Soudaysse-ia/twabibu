import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig, type AppConfig } from './config.js';
import { AdminModule } from './admin/admin.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { BookingModule } from './booking/booking.module.js';
import { DirectoryModule } from './directory/directory.module.js';
import { HealthModule } from './health/health.module.js';
import { MedicalModule } from './medical/medical.module.js';
import { MeModule } from './me/me.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PharmaciesModule } from './pharmacies/pharmacies.module.js';
import { PractitionersModule } from './practitioners/practitioners.module.js';
import { ProModule } from './pro/pro.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { SearchModule } from './search/search.module.js';

@Global()
@Module({})
class ConfigModule {
  static forRoot(config: AppConfig): DynamicModule {
    return { module: ConfigModule, providers: [{ provide: APP_CONFIG, useValue: config }], exports: [APP_CONFIG] };
  }
}

@Module({})
export class AppModule {
  static forRoot(config: AppConfig = loadConfig()): DynamicModule {
    const redis = new URL(config.REDIS_URL);
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot(config),
        PrismaModule,
        RedisModule,
        BullModule.forRoot({
          connection: { host: redis.hostname, port: Number(redis.port || 6379), password: redis.password || undefined },
          prefix: 'twabibu',
        }),
        NotificationsModule.forRoot(config),
        AvailabilityModule,
        AuthModule,
        HealthModule,
        DirectoryModule,
        SearchModule,
        PractitionersModule,
        BookingModule,
        MeModule,
        ProModule,
        MedicalModule.forRoot(config),
        PharmaciesModule,
        AdminModule.forRoot(config),
      ],
    };
  }
}
