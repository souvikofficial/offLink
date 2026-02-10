import { Module } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsController } from './locations.controller';
import { CleanLocationsService } from './clean-locations.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [LocationsController],
    providers: [LocationsService, CleanLocationsService],
})
export class LocationsModule { }
