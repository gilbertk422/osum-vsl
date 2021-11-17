import {Module} from '@nestjs/common';
import {PassportModule} from '@nestjs/passport';
import {JwtStrategy} from './jwt.strategy';
import {AuthzManagementService} from './authz-management.service';

@Module({
  imports: [PassportModule.register({defaultStrategy: 'jwt'})],
  providers: [JwtStrategy, AuthzManagementService],
  exports: [PassportModule, AuthzManagementService]
})
export class AuthzModule {}
