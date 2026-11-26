import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  EXPIRATION_TIMEZONE_PATTERN,
  MAX_TARGET_URL_LENGTH,
} from '../links.constants';

// Intentionally no alias/code/userId: short URLs and ownership are immutable.
export class UpdateLinkDto {
  @ApiPropertyOptional({
    format: 'uri',
    maxLength: MAX_TARGET_URL_LENGTH,
    description: 'HTTP/HTTPS only. Cannot point to the short-link hostname.',
  })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TARGET_URL_LENGTH)
  targetUrl?: string;

  @ApiPropertyOptional({ type: Boolean })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Future ISO timestamp with timezone; null removes expiration.',
  })
  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPIRATION_TIMEZONE_PATTERN, {
    message: 'expiresAt must include a time and timezone',
  })
  expiresAt?: string | null;
}
