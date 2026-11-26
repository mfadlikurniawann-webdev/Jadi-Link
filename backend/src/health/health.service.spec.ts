import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  const queryRaw = jest.fn();
  const service = new HealthService({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);

  it('reports a reachable database', async () => {
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    await expect(service.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      timestamp: expect.any(String) as string,
    });
  });

  it('returns 503 without leaking the database error', async () => {
    queryRaw.mockRejectedValue(new Error('sensitive connection details'));
    await expect(service.check()).rejects.toEqual(
      new ServiceUnavailableException('Database is unavailable'),
    );
  });
});
