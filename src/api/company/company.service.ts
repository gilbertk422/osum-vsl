import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {TypeOrmCrudService} from '@nestjsx/crud-typeorm';

import {Company} from './company.entity';

@Injectable()
export class CompanyService extends TypeOrmCrudService<Company> {
  constructor(@InjectRepository(Company) repo) {
    super(repo);
  }

  async createCompany(data: Object): Promise<Company> {
    let company: Company = this.repo.create(data);
    return await this.repo.save(company);
  }
}
