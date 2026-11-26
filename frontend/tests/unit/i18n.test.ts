import { afterEach, describe, expect, it } from 'vitest';
import { getLocale, setLocale, tr } from '../../src/lib/i18n';
import { dateTime, number } from '../../src/lib/format';
import { validateCredentials } from '../../src/lib/validation';

describe('i18n', () => {
  afterEach(() => setLocale('id'));

  it('defaults to Indonesian', () => {
    expect(getLocale()).toBe('id');
    expect(tr('Halo', 'Hello')).toBe('Halo');
    expect(number(1284)).toBe('1.284');
    expect(dateTime(null)).toBe('Tanpa batas waktu');
  });

  it('switches library messages and number formats to English', () => {
    setLocale('en');
    expect(tr('Halo', 'Hello')).toBe('Hello');
    expect(number(1284)).toBe('1,284');
    expect(dateTime(null)).toBe('No expiry');
    expect(validateCredentials('bad', 'x', false)).toBe(
      'Enter a valid email address.',
    );
  });
});
