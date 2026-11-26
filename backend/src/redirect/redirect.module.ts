import { Module } from '@nestjs/common';
import { RedirectCacheModule } from '../common/cache/redirect-cache.module';
import { ClientIdentityModule } from '../common/client-identity/client-identity.module';
import { ClickBufferService } from './click-buffer.service';
import { ClickRecorderService } from './click-recorder.service';
import { RedirectController } from './redirect.controller';
import { RedirectService } from './redirect.service';

@Module({
  imports: [RedirectCacheModule, ClientIdentityModule],
  controllers: [RedirectController],
  providers: [RedirectService, ClickBufferService, ClickRecorderService],
})
export class RedirectModule {}
