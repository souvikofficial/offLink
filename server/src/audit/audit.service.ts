
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
    constructor(private prisma: PrismaService) { }

    async log(action: string, payload: { userId?: string; deviceId?: string; details?: any; ipAddress?: string }) {
        await this.prisma.auditLog.create({
            data: {
                action,
                userId: payload.userId,
                deviceId: payload.deviceId,
                details: payload.details ?? {},
                ipAddress: payload.ipAddress,
            },
        });
    }
}
