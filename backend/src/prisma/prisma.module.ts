import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// A module groups providers/controllers. Export makes Prisma injectable elsewhere.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
