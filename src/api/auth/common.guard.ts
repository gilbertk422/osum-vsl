import {Injectable, CanActivate, ExecutionContext, Logger} from '@nestjs/common';
import {Reflector} from '@nestjs/core';

@Injectable()
export class CommonGuard implements CanActivate {
  private readonly logger = new Logger(CommonGuard.name);
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!request.user || !request.user[`${process.env.AUTH0_AUDIENCE}/user_meta_data`]) {
      return false;
    }

    request.user.userId = request.user[`${process.env.AUTH0_AUDIENCE}/user_meta_data`].userId;
    request.user.companyId = request.user[`${process.env.AUTH0_AUDIENCE}/user_meta_data`].companyId;

    this.logger.debug(`Request: ${request.path}`);
    this.logger.debug(request.user, 'User data:');

    return (
      !!request.user[`${process.env.AUTH0_AUDIENCE}/user_meta_data`].companyId &&
      !!request.user[`${process.env.AUTH0_AUDIENCE}/user_meta_data`].userId
    );
  }
}
