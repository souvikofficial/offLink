
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationsService {
    constructor(private prisma: PrismaService) { }

    async ingest(deviceId: string, locations: CreateLocationDto[]) {
        const data = locations.map((loc) => ({
            deviceId,
            capturedAt: new Date(loc.capturedAt),
            lat: loc.lat,
            lng: loc.lng,
            accuracyM: loc.accuracyM,
            provider: loc.provider,
            batteryPct: loc.batteryPct,
            isCharging: loc.isCharging,
        }));

        const result = await this.prisma.locationPoint.createMany({
            data,
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
