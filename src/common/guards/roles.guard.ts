import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true; // No roles defined, meaning any authenticated user is allowed
    }
    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.userType) {
      throw new ForbiddenException('User type not found in token');
    }
    if (!requiredRoles.includes(user.userType)) {
      throw new ForbiddenException('Access denied: insufficient privileges');
    }
    return true;
  }
}
