import {
    PipeTransform,
    ArgumentMetadata,
    BadRequestException,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
    constructor(private schema: ZodSchema) { }

    transform(value: unknown, metadata: ArgumentMetadata) {
        if (metadata.type !== 'body') return value;

        const parsed = this.schema.safeParse(value);
        if (parsed.success) return parsed.data;

        const errors = parsed.error.errors.map((err) => ({
            path: err.path.join('.'),
            message: err.message,
        }));

        throw new BadRequestException({
            message: 'Validation failed',
            errors,
        });
    }
}
