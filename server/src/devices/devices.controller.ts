import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DevicesService } from './devices.service';

@Controller('devices')
export class DevicesController {
    constructor(private devicesService: DevicesService) { }

    @Get()
    @UseGuards(AuthGuard('jwt'))
    async getDevices(@Request() req) {
        return this.devicesService.getUserDevices(req.user.userId);
    }
}
