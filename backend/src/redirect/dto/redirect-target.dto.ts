import type { Link } from '@prisma/client';

export type RedirectTargetDto = Readonly<
  Pick<Link, 'id' | 'code' | 'targetUrl' | 'isActive' | 'expiresAt'>
>;
