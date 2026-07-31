import { inject } from '@angular/core';
import { CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';

const isPublicResetPage = (url: string): boolean =>
  url.startsWith('/reset-password') || url.startsWith('/set-initial-password');

export const guestGuard: CanActivateFn = (_, state: RouterStateSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Password-set links must always open the reset page, even when the recipient
  // is already signed in — otherwise a restored session bounces them to the
  // dashboard and the reset link appears broken.
  if (isPublicResetPage(state.url)) {
    return true;
  }

  if (!authService.isAuthenticated()) {
    return authService.restoreSession().pipe(
      map((user) => (user ? router.createUrlTree([authService.redirectPathFor(user)]) : true)),
    );
  }

  return router.createUrlTree([authService.redirectPathFor()]);
};
