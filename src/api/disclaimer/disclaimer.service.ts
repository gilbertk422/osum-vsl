import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {TypeOrmCrudService} from '@nestjsx/crud-typeorm';

import {Disclaimer} from './disclaimer.entity';

@Injectable()
export class DisclaimerService extends TypeOrmCrudService<Disclaimer> {
  constructor(@InjectRepository(Disclaimer) repo) {
    super(repo);
  }
}
