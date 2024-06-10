import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, map } from 'rxjs';

@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {}

  async getGoogleUserInfo(authCode: string) {
    try {
      // 교환할 토큰 요청
      const tokenData = await lastValueFrom(
        this.httpService
          .post(this.config.get<string>('GOOGLE_TOKEN_URL'), {
            code: authCode,
            client_id: this.config.get<string>('GOOGLE_CLIENT_ID'),
            client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET'),
            redirect_uri: this.config.get<string>('GOOGLE_REDIRECT_URI'),
            grant_type: 'authorization_code',
          })
          .pipe(map((response) => response.data)),
      );

      const accessToken = tokenData.access_token;

      // 사용자 정보 요청
      const googleUserInfo = await lastValueFrom(
        this.httpService
          .get(this.config.get<string>('GOOGLE_USERINFO_URL'), {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          .pipe(map((response) => response.data)),
      );

      return { tokenData, googleUserInfo };
    } catch (error) {
      if (error.isAxiosError) {
        // AxiosError를 확인하고 처리
        throw new InternalServerErrorException(
          'Failed to fetch user info',
          error.message,
        );
      }
      throw new InternalServerErrorException(
        'Unexpected error occurred',
        error.message,
      );
    }
  }
}
