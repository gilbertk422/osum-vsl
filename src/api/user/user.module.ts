import {Module} from '@nestjs/common';
import {UserService} from './user.service';
import {UserController} from './user.controller';
import {TypeOrmModule} from '@nestjs/typeorm';
import {User} from './user.entity';
import {CompanyModule} from '../company/company.module';
import {AuthzModule} from 'src/authz/authz.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), CompanyModule, AuthzModule],
  providers: [UserService],
  controllers: [UserController],
  exports: [UserService]
})
export class UserModule {}
