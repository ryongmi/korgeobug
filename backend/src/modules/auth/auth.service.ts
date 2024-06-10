import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { scrypt as _scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { User } from '../../entities/user.entity';
import { EntityManager } from 'typeorm';
import { GoogleOAuthService } from './google-oauth.service';
import { NaverOAuthService } from './naver-oauth.service';

const scrypt = promisify(_scrypt);

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private googleOAuthService: GoogleOAuthService,
    private naverOAuthService: NaverOAuthService,
  ) {}

  async signinNaver(
    transactionManager: EntityManager,
    authCode: string,
    authState: string,
  ) {
    const { tokenData, naverUserInfo } =
      await this.naverOAuthService.getNaverUserInfo(authCode, authState);

    let user;
    const userInfo = await this.userService.findByEmail(naverUserInfo.email);
    if (userInfo) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!userInfo.oauth_id) {
        // 처음 병합할 경우 필요한 정보 업데이트
        userInfo.oauth_id = naverUserInfo.id;
        userInfo.name ||= naverUserInfo.name;
        userInfo.nickname ||= naverUserInfo.nickname;
        userInfo.profile_image ||= naverUserInfo.profile_image;
      }

      // 마지막 접속일 업데이트
      userInfo.last_login = new Date();

      user = await this.userService.updateUser(userInfo);
    } else {
      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(transactionManager, {
        oauth_id: naverUserInfo.id,
        name: naverUserInfo.name,
        nickname: naverUserInfo.nickname,
        email: naverUserInfo.email,
        profile_image: naverUserInfo.profile_image,
      });
    }

    return { user, tokenData };
  }

  async signinGoogle(transactionManager: EntityManager, authCode: string) {
    const { tokenData, googleUserInfo } =
      await this.googleOAuthService.getGoogleUserInfo(authCode);

    const userInfo = await this.userService.findByEmail(googleUserInfo.email);
    let user;

    if (userInfo) {
      // 이메일이 이미 존재하는 경우 계정 병합
      if (!userInfo.oauth_id) {
        // 처음 병합할 경우 필요한 정보 업데이트
        userInfo.oauth_id = googleUserInfo.id;
        userInfo.name ||= googleUserInfo.name;
        userInfo.nickname ||= googleUserInfo.name;
        userInfo.profile_image ||= googleUserInfo.picture;
      }

      // 마지막 접속일 업데이트
      userInfo.last_login = new Date();

      user = await this.userService.updateUser(userInfo);
    } else {
      // 이메일이 존재하지 않는 경우 새 사용자 생성
      user = await this.userService.createUser(transactionManager, {
        oauth_id: googleUserInfo.id,
        name: googleUserInfo.name,
        nickname: googleUserInfo.name,
        email: googleUserInfo.email,
        profile_image: googleUserInfo.picture,
      });
    }

    return { user, tokenData };
  }

  async signin(userId: string, password: string) {
    const user = await this.userService.findByUserId(userId);

    if (!user) {
      throw new NotFoundException('로그인 정보가 일치하지 않습니다.');
    }

    const [salt, storedHash] = user.password.split(';');

    const hash = (await scrypt(password, salt, 32)) as Buffer;
    if (storedHash !== hash.toString('hex')) {
      throw new BadRequestException('로그인 정보가 일치하지 않습니다.');
    }

    // 마지막 로그인 날짜 기록
    await this.userService.lastLoginUpdate(user.id);

    // return await this.userService.lastLoginUpdate(user);
    return user;
  }

  async signup(transactionManager: EntityManager, attrs: Partial<User>) {
    const users = await this.userService.findByUserIdOREmail(
      attrs.user_id,
      attrs.email,
    );

    if (users.length !== 0) {
      throw new BadRequestException('아이디나 이메일이 사용중입니다.');
    }

    const salt = randomBytes(8).toString('hex');

    const hash = (await scrypt(attrs.password, salt, 32)) as Buffer;

    const result = salt + ';' + hash.toString('hex');

    return await this.userService.createUser(transactionManager, attrs, result);
  }
}