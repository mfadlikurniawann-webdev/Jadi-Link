import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserResponseDto } from './dto/user-response.dto';
import type { PublicUser } from './dto/user-response.dto';

export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // Only the authentication service needs the password hash.
  findForLogin(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async create(email: string, passwordHash: string): Promise<PublicUser> {
    try {
      return await this.prisma.user.create({
        data: { email, passwordHash },
        select: PUBLIC_USER_SELECT,
      });
    } catch (error) {
      // Rely on the unique constraint, so concurrent registrations are safe.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async getProfile(userId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PUBLIC_USER_SELECT,
    });
    if (!user) {
      throw new UnauthorizedException('User is no longer available');
    }
    return new UserResponseDto(user);
  }
}
