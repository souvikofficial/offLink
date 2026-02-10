
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationsService {
    constructor(private prisma: PrismaService) { }

    async ingest(deviceId: string, locations: CreateLocationDto[]) {
        // Map DTO to Prisma input format. 
        // Note: createMany with skipDuplicates handles idempotency based on the unique index @@unique([deviceId, capturedAt])
        const data = locations.map((loc) => ({
            deviceId,
            capturedAt: loc.capturedAt, // Date string is automatically handled by Prisma/Date scalar if compatible, but Zod .datetime() ensures ISO string. 
            // Wait, Prisma expects a Date object for DateTime fields. I need to convert it.
            lat: loc.lat,
            lng: loc.lng,
            accuracyM: loc.accuracyM,
            provider: loc.provider,
            batteryPct: loc.batteryPct,
            isCharging: loc.isCharging,
        }));

        // However, Prisma's `createMany` does not support `skipDuplicates` on all databases (e.g. SQL Server), but it DOES on PostgreSQL.
        // The user's schema uses PostgreSQL.

        // Correction: `capturedAt` from Zod is a string, Prisma needs a Date object or compliant ISO string. 
        // Providing a Date object is safer.

        const formattedData = data.map(d => ({
            ...d,
            capturedAt: new Date(d.capturedAt)
        }));

        const result = await this.prisma.locationPoint.createMany({
            data: formattedData,
            skipDuplicates: true,
        });

        return { inserted: result.count };
    }

    async getLatestLocation(deviceId: string) {
        return this.prisma.locationPoint.findFirst({
            where: { deviceId },
            orderBy: { capturedAt: 'desc' },
        });
    }

    async getLocationHistory(deviceId: string, query: { from?: string; to?: string; limit: number }) {
        const { from, to, limit } = query;
        const where: any = { deviceId };

        if (from || to) {
            where.capturedAt = {};
            if (from) where.capturedAt.gte = new Date(from);
            if (to) where.capturedAt.lte = new Date(to);
        }

        return this.prisma.locationPoint.findMany({
            where,
            orderBy: { capturedAt: 'desc' },
            take: limit,
        });
    }
}
