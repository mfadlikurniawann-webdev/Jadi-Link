import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'auth:isPublic';

// Nest attaches metadata here; JwtAuthGuard reads it before requiring a token.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
