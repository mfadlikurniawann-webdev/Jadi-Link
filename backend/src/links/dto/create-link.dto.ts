import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ALIAS_PATTERN,
  EXPIRATION_TIMEZONE_PATTERN,
  MAX_TARGET_URL_LENGTH,
} from '../links.constants';

export class CreateLinkDto {
  @ApiProperty({
    format: 'uri',
    maxLength: MAX_TARGET_URL_LENGTH,
    example: 'https://example.com/article',
    description: 'HTTP/HTTPS only, no credentials or short-link hostname.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TARGET_URL_LENGTH)
  targetUrl!: string;

  @ApiPropertyOptional({
    minLength: 3,
    maxLength: 64,
    pattern: ALIAS_PATTERN.source,
    example: 'my-portfolio',
    description: 'Case-sensitive and immutable. Reserved aliases are rejected.',
  })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @Matches(ALIAS_PATTERN)
  alias?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Future ISO timestamp with timezone, or null for no expiration.',
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPIRATION_TIMEZONE_PATTERN, {
    message: 'expiresAt must include a time and timezone',
  })
  expiresAt?: string | null;
}
