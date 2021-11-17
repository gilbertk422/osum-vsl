import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {TypeOrmCrudService} from '@nestjsx/crud-typeorm';

import {Reference} from './reference.entity';

@Injectable()
export class ReferenceService extends TypeOrmCrudService<Reference> {
  constructor(@InjectRepository(Reference) repo) {
    super(repo);
  }
}
