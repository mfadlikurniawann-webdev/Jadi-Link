import { UserResponseDto } from '../../users/dto/user-response.dto';
import type { PublicUser } from '../../users/dto/user-response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT access token', example: '<access-token>' })
  readonly accessToken: string;
  @ApiProperty({ enum: ['Bearer'] })
  readonly tokenType = 'Bearer';
  @ApiProperty({ type: 'integer', minimum: 60, maximum: 86400, example: 900 })
  readonly expiresIn: number;
  @ApiProperty({ type: () => UserResponseDto })
  readonly user: UserResponseDto;

  constructor(accessToken: string, expiresIn: number, user: PublicUser) {
    this.accessToken = accessToken;
    this.expiresIn = expiresIn;
    this.user = new UserResponseDto(user);
  }
}
