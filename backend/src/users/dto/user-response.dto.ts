import { Exclude, Expose } from 'class-transformer';
import type { User } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export type PublicUser = Pick<User, 'id' | 'email' | 'createdAt'>;

// Exclude by default: future model fields cannot accidentally leak into JSON.
@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({ format: 'uuid' })
  readonly id: string;

  @Expose()
  @ApiProperty({ format: 'email' })
  readonly email: string;

  @Expose()
  @ApiProperty({ type: String, format: 'date-time' })
  readonly createdAt: Date;

  constructor(user: PublicUser) {
    this.id = user.id;
    this.email = user.email;
    this.createdAt = user.createdAt;
  }
}
