import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';

export const PINO = Symbol('PINO');

@Global()
@Module({
  providers: [
    {
      provide: PINO,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const level = config.get<string>('log.level') ?? 'info';
        const pretty = Boolean(config.get('log.pretty'));

        return pino({
          level,
          base: {
            service: 'api',
            env: config.get<string>('env') ?? 'development',
          },
          transport: pretty
            ? {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:standard' },
              }
            : undefined,
        });
      },
    },
    {
      provide: Logger,
      useFactory: () => new Logger(),
    },
  ],
  exports: [PINO],
})
export class LoggerModule {}
