import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entitys/user.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { Role } from './entitys/role.entity';
import { User_Role } from './entitys/user-role.entity';
import { HttpModule } from '@nestjs/axios';
import { GoogleOAuthService } from './google-oauth.service';
import { NaverOAuthService } from './naver-oauth.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role, User_Role]), HttpModule],
  controllers: [UserController],
  providers: [UserService, AuthService, GoogleOAuthService, NaverOAuthService], // 서비스를 providers에 추가
  exports: [UserService, AuthService], // 다른 모듈에서 User 서비스를 사용할 수 있도록 exports에 추가
})
export class UserModule {}
