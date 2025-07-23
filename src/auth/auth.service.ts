import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcrypt';
import { User } from 'src/users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UpdateUserDto } from 'src/users/dto/update-user.dto';
import { ActivationToken } from './entities/activation_token.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserAuth } from './entities/user_auth.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(ActivationToken)
    private readonly activationTokenRepository: Repository<ActivationToken>,
    @InjectRepository(UserAuth)
    private readonly userAuthRepository: Repository<UserAuth>,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email, true);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    delete (user as any).password;
    return user;
  }

  createRefreshToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION_TIME', '7d'),
    });
  }

  createAccessToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRATION_TIME', '1h'),
    });
  }

  generateActivationToken(): string {
    let token = '';
    const characters =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      token += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return token;
  }

  async saveActivationToken(userId: string, token: string) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const activationToken = this.activationTokenRepository.create({
      token,
      userId,
      expiresAt,
    });
    return this.activationTokenRepository.save(activationToken);
  }

  async saveRefreshToken(userId: string, refreshToken: string) {
    // Deactivate any existing refresh tokens for this user
    await this.userAuthRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    // Create new refresh token
    const userAuth = this.userAuthRepository.create({
      userId,
      refreshToken,
      isActive: true,
    });
    return this.userAuthRepository.save(userAuth);
  }

  async register(registerDto: CreateUserDto): Promise<User> {
    const user = await this.usersService.create(registerDto);

    const activationToken = this.generateActivationToken();
    await this.saveActivationToken(user.id, activationToken);

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    const accessToken = this.createAccessToken(user.id);
    const refreshToken = this.createRefreshToken(user.id);
    await this.saveRefreshToken(user.id, refreshToken);
    // TODO: Store refresh token in Redis
    return {
      access_token: accessToken,
      user,
      refresh_token: refreshToken,
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const decoded: { sub: string; email: string } = this.jwtService.verify(
      refreshToken,
      {
        secret: this.configService.get('JWT_SECRET'),
      },
    );

    // Verify refresh token exists and is active
    const userAuth = await this.userAuthRepository.findOne({
      where: { userId: decoded.sub, refreshToken, isActive: true },
    });

    if (!userAuth) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.usersService.findOne(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    const accessToken = this.createAccessToken(user.id);
    const newRefreshToken = this.createRefreshToken(user.id);

    // Save new refresh token and deactivate old one
    await this.saveRefreshToken(user.id, newRefreshToken);

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
    };
  }

  async activateUser(token: string) {
    const activationToken = await this.activationTokenRepository.findOne({
      where: { token, isUsed: false },
    });

    if (!activationToken) {
      throw new UnauthorizedException('Invalid activation token');
    }

    const user = await this.usersService.findOne(activationToken.userId);
    if (!user) {
      throw new UnauthorizedException('Invalid user');
    }

    const updateDto: UpdateUserDto = { isEmailVerified: true };
    await this.usersService.update(user.id, updateDto);
    await this.activationTokenRepository.update(
      { id: activationToken.id },
      { isUsed: true },
    );

    return user;
  }
}
