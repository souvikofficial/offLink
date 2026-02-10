
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CleanLocationsService {
    private readonly logger = new Logger(CleanLocationsService.name);

    constructor(private readonly prisma: PrismaService) { }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleCron() {
        this.logger.debug('Running data retention job...');

        // Default 30 days if not set
        const retentionDays = parseInt(process.env.RETENTION_DAYS || '30', 10);
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - retentionDays);

        try {
            const result = await this.prisma.locationPoint.deleteMany({
                where: {
                    capturedAt: {
                        lt: dateLimit,
                    },
                },
            });
            this.logger.log(`Deleted ${result.count} location points older than ${retentionDays} days.`);
        } catch (error) {
            this.logger.error('Failed to run retention job', error);
        }
    }
}
