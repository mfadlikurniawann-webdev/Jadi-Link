import { Injectable, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';
import type { BufferedClickDto } from './dto/buffered-click.dto';

export const CLICK_BUFFER_MAX = 5000;
export const CLICK_BATCH_SIZE = 500;
export const CLICK_FLUSH_INTERVAL_MS = 5000;

@Injectable()
export class ClickBufferService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickBufferService.name);
  private readonly queue: BufferedClickDto[] = [];
  private timer?: NodeJS.Timeout;
  private flushing?: Promise<void>;
  private closing?: Promise<void>;
  private accepting = true;
  private inFlightCount = 0;
  private dropped = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterHost: HttpAdapterHost,
  ) {}

  get pendingCount(): number {
    return this.queue.length + this.inFlightCount;
  }

  onModuleInit(): void {
    const server = this.adapterHost.httpAdapter.getInstance<FastifyInstance>();
    // Fastify onClose runs after requests finish, before Prisma's shutdown hook.
    server.addHook('onClose', async () => this.close());
    this.timer = setInterval(() => {
      void this.flush();
    }, CLICK_FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    // Continue accepting finished in-flight requests until Fastify closes.
    if (this.timer) clearInterval(this.timer);
  }

  enqueue(click: BufferedClickDto): boolean {
    if (!this.accepting || this.pendingCount >= CLICK_BUFFER_MAX) {
      this.dropped++;
      return false;
    }
    this.queue.push(click);
    return true;
  }

  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.flushSnapshot().finally(() => {
      this.flushing = undefined;
    });
    return this.flushing;
  }

  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.accepting = false;
    if (this.timer) clearInterval(this.timer);
    this.closing = this.drainOnClose();
    return this.closing;
  }

  private async drainOnClose(): Promise<void> {
    await this.flush();
    // Include arrivals that were not part of an already-running flush snapshot.
    // Also allow one bounded retry; never hang shutdown in an endless retry loop.
    if (this.queue.length > 0) await this.flush();
    if (this.queue.length > 0) {
      this.dropped += this.queue.length;
      this.queue.length = 0;
    }
    this.reportDrops();
  }

  private async flushSnapshot(): Promise<void> {
    this.reportDrops();
    let remaining = this.queue.length;
    while (remaining > 0) {
      const batch = this.queue.splice(0, Math.min(CLICK_BATCH_SIZE, remaining));
      remaining -= batch.length;
      this.inFlightCount = batch.length;
      try {
        await this.writeBatch(batch);
      } catch {
        // Stable event UUIDs + skipDuplicates make an ambiguous retry idempotent.
        this.queue.unshift(...batch);
        this.logger.warn(
          'Click batch failed; bounded buffer retained for retry',
        );
        break;
      } finally {
        this.inFlightCount = 0;
      }
    }
  }

  private async writeBatch(batch: BufferedClickDto[]): Promise<void> {
    try {
      await this.prisma.click.createMany({ data: batch, skipDuplicates: true });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2003'
      ) {
        throw error;
      }
      // A link may be deleted after redirect but before this batch is written.
      const links = await this.prisma.link.findMany({
        where: { id: { in: [...new Set(batch.map((click) => click.linkId))] } },
        select: { id: true },
      });
      const liveIds = new Set(links.map((link) => link.id));
      const liveClicks = batch.filter((click) => liveIds.has(click.linkId));
      if (liveClicks.length > 0) {
        await this.prisma.click.createMany({
          data: liveClicks,
          skipDuplicates: true,
        });
      }
      // Another concurrent deletion may still fail; the bounded queue retries it.
    }
  }

  private reportDrops(): void {
    if (this.dropped > 0) {
      this.logger.warn(
        `Dropped ${this.dropped} click events (buffer limit/shutdown)`,
      );
      this.dropped = 0;
    }
  }
}
