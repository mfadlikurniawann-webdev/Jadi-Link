import { isIP } from 'node:net';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsString()
  @IsNotEmpty()
  HOST = '127.0.0.1';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 3001;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  DATABASE_POOL_MAX = 5;

  @IsString()
  @IsNotEmpty()
  FRONTEND_ORIGIN!: string;

  @IsString()
  @IsNotEmpty()
  SHORT_LINK_BASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  TRUST_PROXY = '127.0.0.1,::1';

  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(60)
  @Max(86400)
  JWT_EXPIRES_IN_SECONDS = 900;

  @IsString()
  @MinLength(32)
  VISITOR_HASH_SECRET!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @IsString()
  DIRECT_URL?: string;
}

function isTrustedProxyList(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  return value.split(',').every((entry) => {
    const [ip, prefix, ...extra] = entry.trim().split('/');
    const version = ip ? isIP(ip) : 0;
    if (!version || ip?.includes('%') || extra.length > 0) {
      return false;
    }
    if (prefix === undefined) {
      return true;
    }
    return (
      /^\d+$/.test(prefix) &&
      Number(prefix) > 0 &&
      Number(prefix) <= (version === 4 ? 32 : 128)
    );
  });
}

function isUrlWithProtocol(value: string, protocols: string[]): boolean {
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  const invalidKeys = errors.map((error) => error.property);

  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const value = validated[key];
    if (value && !isUrlWithProtocol(value, ['postgres:', 'postgresql:'])) {
      invalidKeys.push(key);
    }
  }

  for (const key of ['FRONTEND_ORIGIN', 'SHORT_LINK_BASE_URL'] as const) {
    const value = validated[key];
    if (!value || !isUrlWithProtocol(value, ['http:', 'https:'])) {
      invalidKeys.push(key);
      continue;
    }
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      (validated.NODE_ENV === NodeEnvironment.Production &&
        url.protocol !== 'https:')
    ) {
      invalidKeys.push(key);
    }
  }

  if (!isTrustedProxyList(validated.TRUST_PROXY)) {
    invalidKeys.push('TRUST_PROXY');
  }

  if (validated.NODE_ENV === NodeEnvironment.Production) {
    for (const key of ['JWT_SECRET', 'VISITOR_HASH_SECRET'] as const) {
      if (validated[key]?.startsWith('replace-with-')) {
        invalidKeys.push(key);
      }
    }
    if (validated.JWT_SECRET === validated.VISITOR_HASH_SECRET) {
      invalidKeys.push('VISITOR_HASH_SECRET');
    }
  }

  if (invalidKeys.length > 0) {
    // Report keys only: never leak a database URL or secret into logs.
    throw new Error(
      `Invalid environment variables: ${[...new Set(invalidKeys)].join(', ')}`,
    );
  }

  return validated;
}
