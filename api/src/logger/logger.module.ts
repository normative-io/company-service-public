import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SentryInterceptor, SentryModule } from '@ntegral/nestjs-sentry';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    SentryModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        dsn: configService.get('SENTRY_DSN'),
        environment: configService.get('STAGE'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: () => new SentryInterceptor(),
    },
  ],
})
export class LoggerModule {}
