import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthGuard, type AuthenticatedRequest } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { CsrfGuard } from './csrf.guard.js';
import { LoginDto } from './dto/login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.login(dto, request, response);
  }

  @Get('session')
  @UseGuards(AuthGuard)
  getSession(@Req() request: AuthenticatedRequest) {
    return { admin: request.admin };
  }

  @Post('logout')
  @UseGuards(AuthGuard, CsrfGuard)
  logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.authService.logout(request, response);
  }
}
