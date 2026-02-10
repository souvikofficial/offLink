import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
    constructor(private prisma: PrismaService) { }

    async getUserDevices(userId: string) {
        const devices = await this.prisma.device.findMany({
            where: { ownerId: userId },
            include: {
                locations: {
                    orderBy: { capturedAt: 'desc' },
                    take: 1,
                    select: {
                        capturedAt: true,
                        lat: true,
                        lng: true,
                        batteryPct: true,
                        isCharging: true,
                    }
                }
            }
        });

        return devices.map(device => {
            const lastLoc = device.locations[0];
            return {
                id: device.id,
                hardwareId: device.hardwareId,
                name: device.name,
                model: device.model,
                lastLocation: lastLoc ? {
                    capturedAt: lastLoc.capturedAt,
                    lat: lastLoc.lat,
                    lng: lastLoc.lng,
                    batteryPct: lastLoc.batteryPct,
                    isCharging: lastLoc.isCharging,
                } : null
            };
        });
    }
}
