import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { CleanLocationsService } from './clean-locations.service';
import { RetentionService } from './retention.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [LocationsController],
    providers: [LocationsService, CleanLocationsService, RetentionService],
})
export class LocationsModule { }
