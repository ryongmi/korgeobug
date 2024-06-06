import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { scrypt as _scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { User } from './entitys/user.entity';
import { EntityManager } from 'typeorm';

const scrypt = promisify(_scrypt);

@Injectable()
export class AuthService {
  constructor(private userService: UserService) {}

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

    const user = await this.userService.create(
      transactionManager,
      result,
      attrs,
    );

    return user;
  }

  async signinNaver() {}
  async signinGoogle() {}
}
