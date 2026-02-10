import { z } from 'zod';

export const GetLocationsQuerySchema = z.object({
    from: z.string().datetime().optional(), // ISO string
    to: z.string().datetime().optional(),   // ISO string
    limit: z.coerce.number().int().min(1).max(1000).default(50),
});

export type GetLocationsQueryDto = z.infer<typeof GetLocationsQuerySchema>;
