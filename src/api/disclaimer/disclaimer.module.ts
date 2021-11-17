import {Module} from '@nestjs/common';
import {DisclaimerService} from './disclaimer.service';
import {DisclaimerController} from './disclaimer.controller';
import {Disclaimer} from './disclaimer.entity';
import {TypeOrmModule} from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([Disclaimer])],
  providers: [DisclaimerService],
  controllers: [DisclaimerController]
})
export class DisclaimerModule {}
