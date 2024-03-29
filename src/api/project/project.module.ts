import {Module} from '@nestjs/common';
import {ProjectService} from './project.service';
import {ProjectController} from './project.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {Project} from './project.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project])],
  providers: [ProjectService],
  exports: [ProjectService],
  controllers: [ProjectController]
})
export class ProjectModule {}
