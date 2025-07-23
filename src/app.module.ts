import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { User } from './users/entities/user.entity';
import { AuthModule } from './auth/auth.module';
import { UserAuth } from './auth/entities/user_auth.entity';
import { ActivationToken } from './auth/entities/activation_token.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../../.env',
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().required().valid('development', 'production'),
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_USER: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_DB: Joi.string().required(),
        POSTGRES_INTERNAL_PORT: Joi.number().required(),
        POSTGRES_EXTERNAL_PORT: Joi.number().required(),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
        URL_SERVICE_PORT: Joi.number().required(),
        REDIRECT_SERVICE_PORT: Joi.number().required(),
        ANALYTICS_SERVICE_PORT: Joi.number().required(),
        REDIS_PORT: Joi.number().required(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('POSTGRES_HOST'),
        port: configService.get('POSTGRES_INTERNAL_PORT'),
        username: configService.get('POSTGRES_USER'),
        password: configService.get('POSTGRES_PASSWORD'),
        database: configService.get('POSTGRES_DB'),
        entities: [User, UserAuth, ActivationToken],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    TypeOrmModule.forFeature([User, UserAuth, ActivationToken]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
