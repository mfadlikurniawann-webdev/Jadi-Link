import { UserResponseDto } from '../../users/dto/user-response.dto';
import type { PublicUser } from '../../users/dto/user-response.dto';

export class AuthResponseDto {
  readonly accessToken: string;
  readonly tokenType = 'Bearer';
  readonly expiresIn: number;
  readonly user: UserResponseDto;

  constructor(accessToken: string, expiresIn: number, user: PublicUser) {
    this.accessToken = accessToken;
    this.expiresIn = expiresIn;
    this.user = new UserResponseDto(user);
  }
}
