import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmployeeRole } from '../employee/employee.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorator to set required roles on a controller method.
 */
export function Roles(...roles: EmployeeRole[]) {
  return (
    target: object,
    key?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    if (key !== undefined && descriptor !== undefined) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value as object);
    }
    return descriptor;
  };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<EmployeeRole[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { role: EmployeeRole };
    }>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    return true;
  }
}
