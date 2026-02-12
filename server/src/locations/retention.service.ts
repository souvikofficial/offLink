import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private retentionDays: number;

  constructor(private prisma: PrismaService, private config: ConfigService) {
    this.retentionDays = this.config.get<number>('RETENTION_DAYS', 90);
  }

  // Run daily at 02:00 UTC
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handlePrune() {
    try {
      const cutoff = new Date(Date.now() - this.retentionDays * 24 * 60 * 60 * 1000);
      this.logger.log(`Running retention prune, deleting points before ${cutoff.toISOString()}`);
      const result = await this.prisma.locationPoint.deleteMany({
        where: {
          capturedAt: { lt: cutoff },
        },
      });
      this.logger.log(`Pruned ${result.count} location points older than ${this.retentionDays} days`);
    } catch (err) {
      this.logger.error('Retention prune failed', err as any);
    }
  }
}
