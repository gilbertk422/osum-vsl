import {applyDecorators, SetMetadata, UseGuards} from '@nestjs/common';
import {AuthGuard} from '@nestjs/passport';
import {CommonGuard} from './common.guard';
import {ApiBearerAuth} from '@nestjs/swagger';
import {RolesGuard} from './roles.guard';

export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata('roles', roles),
    UseGuards(AuthGuard('jwt'), CommonGuard, RolesGuard),
    ApiBearerAuth()
  );
}
