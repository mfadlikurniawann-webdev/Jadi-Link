import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  IsByteLength,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
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
    minLength: 12,
    maxLength: 72,
    description:
      'At least 12 characters and at most 72 UTF-8 bytes. Not trimmed.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(12)
  @MaxLength(72)
  @IsByteLength(0, 72, {
    message: 'password must not exceed 72 UTF-8 bytes',
  })
  password!: string;
}
