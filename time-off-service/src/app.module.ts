import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { EmployeeModule } from './employee/employee.module';
import { BalanceModule } from './balance/balance.module';
import { TimeOffModule } from './time-off/time-off.module';
import { SyncModule } from './sync/sync.module';
import { HcmClientModule } from './hcm-client/hcm-client.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { HolidayModule } from './holiday/holiday.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        ssl: { rejectUnauthorized: false },
        extra: {
          max: 10,
          min: 2,
        },
      }),
    }),

    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    AuthModule,
    EmployeeModule,
    BalanceModule,
    TimeOffModule,
    SyncModule,
    HcmClientModule,
    AuditModule,
    HolidayModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
