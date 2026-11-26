import { withUtcTimezone } from './connection-options';

describe('PostgreSQL connection timezone', () => {
  it('sets UTC on every connection and preserves credentials, SSL and other params', () => {
    const original =
      'postgresql://user:p%40ss@localhost:5432/jadi_link?sslmode=verify-full&application_name=jadi-link';
    const result = new URL(withUtcTimezone(original));
    expect(result.searchParams.get('options')).toBe('-c TimeZone=UTC');
    expect(result.searchParams.get('sslmode')).toBe('verify-full');
    expect(result.searchParams.get('application_name')).toBe('jadi-link');
    expect(result.username).toBe('user');
    expect(result.password).toBe('p%40ss');
  });

  it('preserves existing connection options and gives UTC the final precedence', () => {
    const original = new URL('postgresql://localhost/jadi_link');
    original.searchParams.set(
      'options',
      '-c TimeZone=Asia/Bangkok -c statement_timeout=5000',
    );
    const result = new URL(withUtcTimezone(original.toString()));
    expect(result.searchParams.get('options')).toBe(
      '-c TimeZone=Asia/Bangkok -c statement_timeout=5000 -c TimeZone=UTC',
    );
  });
});
