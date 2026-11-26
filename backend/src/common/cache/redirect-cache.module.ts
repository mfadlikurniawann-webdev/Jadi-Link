import { Module } from '@nestjs/common';
import { RedirectCacheService } from './redirect-cache.service';

// Both LinksModule and RedirectModule import this one shared cache provider.
@Module({
  providers: [RedirectCacheService],
  exports: [RedirectCacheService],
})
export class RedirectCacheModule {}
