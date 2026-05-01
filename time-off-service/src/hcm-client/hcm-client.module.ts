import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HcmClientService } from './hcm-client.service';

@Module({
  imports: [ConfigModule],
  providers: [HcmClientService],
  exports: [HcmClientService],
})
export class HcmClientModule {}
