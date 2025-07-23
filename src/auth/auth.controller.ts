import { Body, Controller, Param, Post, Get } from '@nestjs/common';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { AuthService } from './auth.service';
import { ApiError, ApiResponse } from 'src/common/types';
import { User } from 'src/users/entities/user.entity';
import { LoginDto } from './dto/login.dto';

type LoginResponse = {
  user: User;
  access_token: string;
  refresh_token: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() registerDto: CreateUserDto,
  ): Promise<ApiResponse<User>> {
    const response = await this.authService.register(registerDto);
    return {
      data: response,
      message: 'User registered successfully',
      statusCode: 201,
    };
  }

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
  ): Promise<ApiResponse<LoginResponse> | ApiError> {
    const response = await this.authService.login(loginDto);
    return {
      data: response,
      message: 'User logged in successfully',
      statusCode: 200,
    };
  }

  @Get('activate')
  async activate(@Param('token') token: string): Promise<ApiResponse<User>> {
    const response = await this.authService.activateUser(token);
    return {
      data: response,
      message: 'User activated successfully',
      statusCode: 200,
    };
  }
}
