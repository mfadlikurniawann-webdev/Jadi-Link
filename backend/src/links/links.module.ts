import { Module } from '@nestjs/common';
import { RedirectCacheModule } from '../common/cache/redirect-cache.module';
import { CodeGeneratorService } from './code-generator.service';
import { LinkPolicyService } from './link-policy.service';
import { LinksController } from './links.controller';
import { LinksService } from './links.service';

@Module({
  imports: [RedirectCacheModule],
  controllers: [LinksController],
  providers: [LinksService, CodeGeneratorService, LinkPolicyService],
})
export class LinksModule {}
