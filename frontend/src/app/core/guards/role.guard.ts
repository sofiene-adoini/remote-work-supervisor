import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = route.data?.['roles'] as string[] | undefined;

  return auth.restoreSession().pipe(
    map((user) => {
      // Unauthenticated -> /login (not to a dashboard, which would then bounce).
      if (!user) {
        return router.createUrlTree(['/login']);
      }

      const roleName = user.role?.name;
      if (roleName && allowedRoles?.includes(roleName)) {
        return true;
      }

      // Authenticated but not allowed on this route -> their own dashboard.
      return router.createUrlTree([auth.redirectPathFor(user)]);
    }),
  );
};
