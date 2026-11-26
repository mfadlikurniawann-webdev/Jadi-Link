import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({ format: 'email', maxLength: 254, example: 'user@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    format: 'password',
    writeOnly: true,
    example: 'development-only-password-123',
    minLength: 1,
    maxLength: 72,
    description: 'Not trimmed. Maximum 72 UTF-8 bytes, not just characters.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  @IsByteLength(0, 72, {
    message: 'password must not exceed 72 UTF-8 bytes',
  })
  password!: string;
}
