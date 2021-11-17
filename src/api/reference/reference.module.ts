import {Module} from '@nestjs/common';
import {ReferenceService} from './reference.service';
import {ReferenceController} from './reference.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Reference} from './reference.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Reference])],
  providers: [ReferenceService],
  controllers: [ReferenceController]
})
export class ReferenceModule {}
