import {HttpModule, Module} from '@nestjs/common';
import {GcpService} from './services/gcp/gcp.service';
import {StoreService} from './services/store/store.service';

@Module({
  imports: [HttpModule],
  providers: [GcpService, StoreService],
  exports: [GcpService, StoreService]
})
export class SharedModule {}
