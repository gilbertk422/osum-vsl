import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {TypeOrmCrudService} from '@nestjsx/crud-typeorm';

import {User} from './user.entity';

@Injectable()
export class UserService extends TypeOrmCrudService<User> {
  constructor(@InjectRepository(User) repo) {
    super(repo);
  }

  async getUserBySubWithCompany(sub: string): Promise<User> {
    return this.repo.findOne({
      where: {
        auth0id: sub
      },
      relations: ['company']
    });
  }

  async createUserWithSub(sub: string): Promise<any> {
    const user = this.repo.create({auth0id: sub});
    return this.repo.save(user);
  }

  async saveUser(user: User): Promise<User> {
    return this.repo.save(user);
  }
}
