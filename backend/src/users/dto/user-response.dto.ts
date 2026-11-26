import { Exclude, Expose } from 'class-transformer';
import type { User } from '@prisma/client';

export type PublicUser = Pick<User, 'id' | 'email' | 'createdAt'>;

// Exclude by default: future model fields cannot accidentally leak into JSON.
@Exclude()
export class UserResponseDto {
  @Expose()
  readonly id: string;

  @Expose()
  readonly email: string;

  @Expose()
  readonly createdAt: Date;

  constructor(user: PublicUser) {
    this.id = user.id;
    this.email = user.email;
    this.createdAt = user.createdAt;
  }
}
