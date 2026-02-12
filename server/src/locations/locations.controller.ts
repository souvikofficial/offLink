
import { Controller, Post, Headers, Body, UsePipes, Get, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LocationsService } from './locations.service';
import type { CreateLocationDto } from './dto/create-location.dto';
import { CreateLocationSchema } from './dto/create-location.dto';
import type { GetLocationsQueryDto } from './dto/get-locations-query.dto';
import { GetLocationsQuerySchema } from './dto/get-locations-query.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DeviceTokenGuard } from '../common/guards/device-token.guard';
import { z } from 'zod';

const CreateLocationsSchema = z.array(CreateLocationSchema);

@Controller()
@UseGuards(ThrottlerGuard)
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Post('ingest/locations')
    @UseGuards(DeviceTokenGuard)
    @UsePipes(new ZodValidationPipe(CreateLocationsSchema))
    async ingest(
        @Request() req: any,
        @Body() locations: CreateLocationDto[],
    ) {
        // Device is validated and attached by DeviceTokenGuard
        return this.locationsService.ingest(req.device.id, locations);
    }

    @Get('devices/:id/last-location')
    async getLastLocation(@Param('id') deviceId: string) {
        return this.locationsService.getLatestLocation(deviceId);
    }

    @Get('devices/:id/locations')
    async getLocations(
        @Param('id') deviceId: string,
        @Query(new ZodValidationPipe(GetLocationsQuerySchema)) query: GetLocationsQueryDto
    ) {
        return this.locationsService.getLocationHistory(deviceId, query);
    }
}
