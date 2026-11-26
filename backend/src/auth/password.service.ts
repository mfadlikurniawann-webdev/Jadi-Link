import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

export const BCRYPT_ROUNDS = 12;

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password, BCRYPT_ROUNDS);
  }

  verify(password: string, passwordHash: string): Promise<boolean> {
    return compare(password, passwordHash);
  }
}
