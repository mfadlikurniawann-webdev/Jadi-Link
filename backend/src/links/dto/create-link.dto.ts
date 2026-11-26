import {
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  ALIAS_PATTERN,
  EXPIRATION_TIMEZONE_PATTERN,
  MAX_TARGET_URL_LENGTH,
} from '../links.constants';

export class CreateLinkDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_TARGET_URL_LENGTH)
  targetUrl!: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @Matches(ALIAS_PATTERN)
  alias?: string;

  @IsOptional()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(EXPIRATION_TIMEZONE_PATTERN, {
    message: 'expiresAt must include a time and timezone',
  })
  expiresAt?: string | null;
}
