import { Module } from '@nestjs/common';
import { ClientIdentityService } from './client-identity.service';

@Module({
  providers: [ClientIdentityService],
  exports: [ClientIdentityService],
})
export class ClientIdentityModule {}
