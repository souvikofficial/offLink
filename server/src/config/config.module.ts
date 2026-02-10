import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './env';

/**
 * AppConfigModule wraps @nestjs/config with Zod-based validation.
 * Import this module in AppModule to enable validated, typed config access.
 */
@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            validate,
        }),
    ],
})
export class AppConfigModule { }
