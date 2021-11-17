import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {TypeOrmCrudService} from '@nestjsx/crud-typeorm';

import {Project} from './project.entity';

@Injectable()
export class ProjectService extends TypeOrmCrudService<Project> {
  constructor(@InjectRepository(Project) repo) {
    super(repo);
  }

  async getProject(projectId: number): Promise<Project> {
    return this.repo.findOne(projectId);
  }
}
