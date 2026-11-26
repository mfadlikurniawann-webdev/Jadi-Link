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
import {
  EXPIRATION_TIMEZONE_PATTERN,
  MAX_TARGET_URL_LENGTH,
} from '../links.constants';

// Intentionally no alias/code/userId: short URLs and ownership are immutable.
export class UpdateLinkDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TARGET_URL_LENGTH)
  targetUrl?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPIRATION_TIMEZONE_PATTERN, {
    message: 'expiresAt must include a time and timezone',
  })
  expiresAt?: string | null;
}
