import {Injectable, CanActivate, ExecutionContext, UnauthorizedException} from '@nestjs/common';
import {Reflector} from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) {
      return true;
    }
    if (roles.length == 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const authzRoles = request.user[process.env.AUTH0_AUDIENCE + '/roles'];

    for (let role of roles) {
      if (authzRoles.indexOf(role) != -1) {
        return true;
      }
    }

    throw new UnauthorizedException('no role');
  }
}
