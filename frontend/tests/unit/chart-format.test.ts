import { describe, expect, it } from 'vitest';
import { chartGeometry } from '../../src/lib/chart';
import {
  countryName,
  dateTime,
  displayUrl,
  linkStatus,
} from '../../src/lib/format';
import type { ShortLink } from '../../src/lib/types';

describe('chart geometry', () => {
  it('plots counts within the viewport with consistent X spacing', () => {
    const result = chartGeometry([0, 5, 10]);
    expect(result.points).toEqual([
      { x: 20, y: 200 },
      { x: 380, y: 110 },
      { x: 740, y: 20 },
    ]);
    expect(result.area).toContain('Z');
    expect(result.line).not.toContain('NaN');
  });
  it('handles no clicks, one point and an empty series without division by zero', () => {
    expect(chartGeometry([0, 0]).points.every((point) => point.y === 200)).toBe(
      true,
    );
    expect(chartGeometry([3]).points[0]?.x).toBe(20);
    expect(chartGeometry([]).area).toBe('');
  });
});

describe('display helpers', () => {
  const link = { isActive: true, expiresAt: null } as ShortLink;
  it('distinguishes inactive, expired and available links', () => {
    expect(linkStatus(link, 100)).toBe('active');
    expect(
      linkStatus({ ...link, expiresAt: '1970-01-01T00:00:00.100Z' }, 100),
    ).toBe('expired');
    expect(linkStatus({ ...link, isActive: false }, 100)).toBe('inactive');
  });
  it('formats safe owner-facing labels without leaking URL queries in compact labels', () => {
    expect(
      displayUrl('https://example.com/article?private=value#section'),
    ).toBe('example.com/article');
    expect(countryName('ID')).toBe('Indonesia');
    expect(countryName(null)).toBe('Tidak diketahui');
    expect(dateTime(null)).toBe('Tanpa batas waktu');
    expect(dateTime('invalid')).toBe('Tanggal tidak valid');
  });
});
