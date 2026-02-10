import { z } from 'zod';

export const CreateLocationSchema = z.object({
    capturedAt: z.string().datetime(),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracyM: z.number().optional(),
    provider: z.string().optional(),
    batteryPct: z.number().min(0).max(100).optional(),
    isCharging: z.boolean().optional(),
});

export type CreateLocationDto = z.infer<typeof CreateLocationSchema>;
