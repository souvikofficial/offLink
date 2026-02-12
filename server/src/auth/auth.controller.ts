import { Controller, Post, Body, UsePipes, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginSchema } from './dto/login.dto';
import type { LoginDto } from './dto/login.dto';
import { RegisterSchema } from './dto/register.dto';
import type { RegisterDto } from './dto/register.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    @UsePipes(new ZodValidationPipe(LoginSchema))
    async login(@Body() loginDto: LoginDto) {
        return this.authService.login(loginDto);
    }

    @Post('register')
    @UsePipes(new ZodValidationPipe(RegisterSchema))
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }
}
