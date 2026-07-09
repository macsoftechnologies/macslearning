import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No specific permissions required
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super Admins without any specific restrictions might be allowed everything?
    // Or we strictly enforce that they need the toggle. Let's strictly enforce the toggle.
    // However, the main 'SUPER_ADMIN' (the original one) probably needs all permissions.
    // If the original super admin has userType = 'SUPER_ADMIN' and no modulePermissions,
    // we can either grant them everything or require them to have it.
    // Let's assume if it's the main super admin (usually no organizationId and maybe a specific email, or we just rely on permissions).
    // The user requested: "Super Admin should have one team like under Super Admin there should be some things to be done like tracking finance... so modification and everything should be done for that role like that."
    // Let's just check permissions array.
    const userPermissions = user.permissions || [];

    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission),
    );

    // Special case for root super admin who might have access to everything,
    // but if we enforce toggles, we stick to the toggles.
    // If they have NO modulePermissions set, they are the root admin
    if (user.userType === 'SUPER_ADMIN' && userPermissions.length === 0) {
      return true;
    }

    if (!hasPermission) {
      throw new ForbiddenException('Access denied: insufficient privileges');
    }

    return true;
  }
}
