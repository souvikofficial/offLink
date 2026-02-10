
import { Controller, Post, Headers, Body, UsePipes, BadRequestException, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LocationsService } from './locations.service';
import type { CreateLocationDto } from './dto/create-location.dto';
import { CreateLocationSchema } from './dto/create-location.dto';
import type { GetLocationsQueryDto } from './dto/get-locations-query.dto';
import { GetLocationsQuerySchema } from './dto/get-locations-query.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { z } from 'zod';

const CreateLocationsSchema = z.array(CreateLocationSchema);

@Controller()
@UseGuards(ThrottlerGuard)
export class LocationsController {
    constructor(private readonly locationsService: LocationsService) { }

    @Post('ingest/locations')
    @UsePipes(new ZodValidationPipe(CreateLocationsSchema))
    async ingest(
        @Headers('x-device-id') deviceId: string,
        @Body() locations: CreateLocationDto[],
    ) {
        if (!deviceId) {
            throw new BadRequestException('x-device-id header is required');
        }

        return this.locationsService.ingest(deviceId, locations);
    }

    @Get('devices/:id/last-location')
    async getLastLocation(@Param('id') deviceId: string) {
        return this.locationsService.getLatestLocation(deviceId);
    }

    @Get('devices/:id/locations')
    @UsePipes(new ZodValidationPipe(GetLocationsQuerySchema))
    async getLocations(
        @Param('id') deviceId: string,
        @Query() query: GetLocationsQueryDto
    ) {
        return this.locationsService.getLocationHistory(deviceId, query);
    }
}
