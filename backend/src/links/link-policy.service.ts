import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isISO8601 } from 'class-validator';
import type { EnvironmentVariables } from '../common/config/environment';
import {
  ALIAS_PATTERN,
  EXPIRATION_TIMEZONE_PATTERN,
  MAX_TARGET_URL_LENGTH,
  RESERVED_ALIASES,
} from './links.constants';

@Injectable()
export class LinkPolicyService {
  private readonly shortLinkHostname: string;

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    this.shortLinkHostname = this.normalizeHostname(
      new URL(config.get('SHORT_LINK_BASE_URL')).hostname,
    );
  }

  validateTargetUrl(input: string): string {
    const invalidUrl = () =>
      new BadRequestException(
        'targetUrl must be a valid HTTP or HTTPS URL without credentials',
      );
    if (typeof input !== 'string') {
      throw invalidUrl();
    }
    const value = input.trim();
    if (
      value.length > MAX_TARGET_URL_LENGTH ||
      !/^https?:\/\/[^/?#]/i.test(value) ||
      value.includes('\\') ||
      [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 0x20 || code === 0x7f;
      })
    ) {
      throw invalidUrl();
    }

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw invalidUrl();
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.href.length > MAX_TARGET_URL_LENGTH
    ) {
      throw invalidUrl();
    }
    // Compare hostname, not origin: changing scheme/port cannot bypass this.
    if (this.normalizeHostname(url.hostname) === this.shortLinkHostname) {
      throw new BadRequestException(
        'targetUrl cannot point to the short-link hostname',
      );
    }
    return url.href;
  }

  validateAlias(alias: string): string {
    if (typeof alias !== 'string' || !ALIAS_PATTERN.test(alias)) {
      throw new BadRequestException(
        'alias must be 3–64 characters, start with a letter or digit, and contain only letters, digits, "_" or "-"',
      );
    }
    if (RESERVED_ALIASES.has(alias.toLowerCase())) {
      throw new BadRequestException('alias is reserved');
    }
    return alias;
  }

  parseExpiration(value: string | null | undefined): Date | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (
      typeof value !== 'string' ||
      !isISO8601(value, { strict: true, strictSeparator: true }) ||
      !EXPIRATION_TIMEZONE_PATTERN.test(value)
    ) {
      throw new BadRequestException(
        'expiresAt must be an ISO 8601 date-time with a timezone',
      );
    }
    const expiration = new Date(value);
    if (
      !Number.isFinite(expiration.getTime()) ||
      expiration.getTime() <= Date.now()
    ) {
      throw new BadRequestException('expiresAt must be in the future');
    }
    return expiration;
  }

  private normalizeHostname(hostname: string): string {
    return hostname.toLowerCase().replace(/\.+$/, '');
  }
}
