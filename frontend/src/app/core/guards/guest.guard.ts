import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return authService.restoreSession().pipe(
      map((user) => (user ? router.createUrlTree([authService.redirectPathFor(user)]) : true)),
    );
  }

  return router.createUrlTree([authService.redirectPathFor()]);
};
