import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import {
  CLICK_BATCH_SIZE,
  CLICK_BUFFER_MAX,
  CLICK_FLUSH_INTERVAL_MS,
  ClickBufferService,
} from './click-buffer.service';
import type { BufferedClickDto } from './dto/buffered-click.dto';

describe('ClickBufferService', () => {
  let buffer: ClickBufferService;
  let warn: jest.SpyInstance;
  const prisma = {
    click: { createMany: jest.fn() },
    link: { findMany: jest.fn() },
  };
  const server = {
    addHook: jest.fn((name: string, close: () => Promise<void>) => ({
      name,
      close,
    })),
  };
  const host = { httpAdapter: { getInstance: () => server } };
  const makeClick = (
    linkId = '11111111-1111-4111-8111-111111111111',
  ): BufferedClickDto => ({
    id: randomUUID(),
    linkId,
    clickedAt: new Date(),
    referrer: null,
    country: 'ID',
    device: 'desktop',
    visitorHash: null,
  });
  const foreignKeyError = () =>
    new Prisma.PrismaClientKnownRequestError('Foreign key failed', {
      code: 'P2003',
      clientVersion: '7.10.1',
    });

  beforeEach(() => {
    jest.resetAllMocks();
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    prisma.click.createMany.mockResolvedValue({ count: 1 });
    buffer = new ClickBufferService(
      prisma as unknown as PrismaService,
      host as unknown as HttpAdapterHost,
    );
  });
  afterEach(async () => {
    await buffer.close();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('enqueues without performing database I/O', () => {
    expect(buffer.enqueue(makeClick())).toBe(true);
    expect(buffer.pendingCount).toBe(1);
    expect(prisma.click.createMany).not.toHaveBeenCalled();
  });

  it('writes batches of at most 500 with duplicate protection', async () => {
    for (let index = 0; index < CLICK_BATCH_SIZE + 1; index++)
      buffer.enqueue(makeClick());
    await buffer.flush();
    expect(prisma.click.createMany).toHaveBeenCalledTimes(2);
    expect(prisma.click.createMany).toHaveBeenNthCalledWith(1, {
      data: expect.any(Array) as BufferedClickDto[],
      skipDuplicates: true,
    });
    const batches = prisma.click.createMany.mock.calls.map(
      ([options]: [{ data: BufferedClickDto[] }]) => options.data.length,
    );
    expect(batches).toEqual([500, 1]);
    expect(buffer.pendingCount).toBe(0);
  });

  it('drops excess events instead of allowing unbounded memory growth', () => {
    for (let index = 0; index < CLICK_BUFFER_MAX; index++) {
      expect(buffer.enqueue(makeClick())).toBe(true);
    }
    expect(buffer.enqueue(makeClick())).toBe(false);
    expect(buffer.pendingCount).toBe(CLICK_BUFFER_MAX);
  });

  it('serializes concurrent flushes and counts in-flight events against the limit', async () => {
    let finish!: (value: { count: number }) => void;
    prisma.click.createMany.mockReturnValueOnce(
      new Promise<{ count: number }>((resolve) => {
        finish = resolve;
      }),
    );
    buffer.enqueue(makeClick());
    const first = buffer.flush();
    expect(buffer.flush()).toBe(first);
    for (let index = 1; index < CLICK_BUFFER_MAX; index++)
      buffer.enqueue(makeClick());
    expect(buffer.enqueue(makeClick())).toBe(false);
    expect(buffer.pendingCount).toBe(CLICK_BUFFER_MAX);
    finish({ count: 1 });
    await first;
    expect(prisma.click.createMany).toHaveBeenCalledTimes(1);
    expect(buffer.pendingCount).toBe(CLICK_BUFFER_MAX - 1);
  });

  it('retains failed events and retries using the original UUIDs', async () => {
    const click = makeClick();
    prisma.click.createMany.mockRejectedValueOnce(new Error('DB unavailable'));
    buffer.enqueue(click);
    await expect(buffer.flush()).resolves.toBeUndefined();
    expect(buffer.pendingCount).toBe(1);
    await buffer.flush();
    expect(prisma.click.createMany).toHaveBeenNthCalledWith(2, {
      data: [click],
      skipDuplicates: true,
    });
    expect(buffer.pendingCount).toBe(0);
  });

  it('filters deleted links after an FK failure without poisoning live events', async () => {
    const live = makeClick();
    const deleted = makeClick('22222222-2222-4222-8222-222222222222');
    prisma.click.createMany.mockRejectedValueOnce(foreignKeyError());
    prisma.link.findMany.mockResolvedValue([{ id: live.linkId }]);
    buffer.enqueue(live);
    buffer.enqueue(deleted);
    await buffer.flush();
    expect(prisma.click.createMany).toHaveBeenNthCalledWith(2, {
      data: [live],
      skipDuplicates: true,
    });
    expect(buffer.pendingCount).toBe(0);
  });

  it('discards a batch when all parent links have been deleted', async () => {
    prisma.click.createMany.mockRejectedValueOnce(foreignKeyError());
    prisma.link.findMany.mockResolvedValue([]);
    buffer.enqueue(makeClick());
    await buffer.flush();
    expect(prisma.click.createMany).toHaveBeenCalledTimes(1);
    expect(buffer.pendingCount).toBe(0);
  });

  it('flushes every five seconds and drains through Fastify onClose', async () => {
    jest.useFakeTimers();
    buffer.onModuleInit();
    buffer.enqueue(makeClick());
    await jest.advanceTimersByTimeAsync(CLICK_FLUSH_INTERVAL_MS);
    expect(prisma.click.createMany).toHaveBeenCalledTimes(1);
    buffer.enqueue(makeClick());
    const onClose = server.addHook.mock.calls[0]?.[1];
    expect(onClose).toBeDefined();
    await onClose!();
    expect(prisma.click.createMany).toHaveBeenCalledTimes(2);
    expect(buffer.enqueue(makeClick())).toBe(false);
  });

  it('bounds shutdown retries and reports dropped events without logging payloads', async () => {
    prisma.click.createMany.mockRejectedValue(new Error('DB unavailable'));
    buffer.enqueue(makeClick());
    const first = buffer.close();
    expect(buffer.close()).toBe(first);
    await first;
    expect(prisma.click.createMany).toHaveBeenCalledTimes(2);
    expect(buffer.pendingCount).toBe(0);
    expect(buffer.enqueue(makeClick())).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      'Dropped 1 click events (buffer limit/shutdown)',
    );
  });
});
