export function withUtcTimezone(connectionString: string): string {
  const url = new URL(connectionString);
  const existingOptions = url.searchParams.get('options')?.trim();
  // Prisma's pg adapter serializes DateTime without an offset. Enforce UTC on
  // every new connection, not a one-off SET on one connection in the pool.
  url.searchParams.set(
    'options',
    [existingOptions, '-c TimeZone=UTC'].filter(Boolean).join(' '),
  );
  return url.toString();
}
