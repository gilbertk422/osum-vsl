import {Injectable} from '@nestjs/common';
import {ManagementClient} from 'auth0';
import {ROLES} from './authz.constant';

@Injectable()
export class AuthzManagementService {
  managementClient: ManagementClient;

  constructor() {
    this.managementClient = new ManagementClient({
      domain: `${process.env.AUTH0_ACCOUNT}.auth0.com`,
      clientId: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      scope: 'read:users update:users',
      audience: `https://${process.env.AUTH0_ACCOUNT}.auth0.com/api/v2/`,
      tokenProvider: {
        enableCache: true,
        cacheTTLInSeconds: 10
      }
    });
  }

  public async updateUser(userSub: string, data: Object): Promise<any> {
    return await this.managementClient.users.update({id: userSub}, data);
  }

  public async assignRoleToUser(userSub: string, role: string) {
    if (role) return await this.managementClient.roles.assignUsers({id: ROLES[role]}, {users: [userSub]});
  }
}
