import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../features/auth/services/auth.service';

/**
 * HTTP interceptor:
 *  1. Attaches `Authorization: Bearer <jwt>` to outgoing requests when an in-memory
 *     access token is available. `withCredentials: true` ensures the httpOnly refresh
 *     cookie (if any) is sent on every request, so `/auth/refresh` can read it.
 *  2. On a 401 from a non-auth request, attempts a single silent refresh then retries
 *     the original request exactly once. If the retry also 401s (or refresh itself
 *     fails), the interceptor forces a logout and the original error is propagated.
 *
 * Concurrency: concurrent 401s share the same in-flight refresh because
 * `AuthService.refreshToken()` deduplicates internally via `refreshInFlight`.
 *
 * Retry guard: a request cloned via `clone()` with `reportProgress: false` carries
 * an extra `_retryAttempt` property. The interceptor inspects this to ensure only
 * one retry is ever issued per original request, breaking any potential infinite loop.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  const isAuthRequest =
    req.url.includes('/auth/local') ||
    req.url.includes('/auth/refresh') ||
    req.url.includes('/auth/logout') ||
    req.url.includes('/auth/me') ||
    req.url.includes('/auth/forgot-password') ||
    req.url.includes('/auth/reset-password');

  const attachToken = (request: HttpRequest<unknown>): HttpRequest<unknown> => {
    const token = auth.token;
    return token
      ? request.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
          withCredentials: true,
        })
      : request.clone({ withCredentials: true });
  };

  // Guard: prevent infinite retry loops.  If this request already carries a
  // retry marker, do NOT attempt another refresh — propagate the error.
  const alreadyRetried = (req as any)._retryAttempt === true;
  if (alreadyRetried) {
    return next(attachToken(req));
  }

  return next(attachToken(req)).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        isAuthRequest
      ) {
        return throwError(() => error);
      }

      // `refreshToken()` deduplicates concurrent callers via `refreshInFlight`,
      // so multiple simultaneous 401s only fire a single /auth/refresh request.
      return auth.refreshToken().pipe(
        switchMap((newToken) => {
          if (!newToken) {
            // Refresh succeeded but returned no token -> session truly dead.
            void auth.logout().subscribe();
            return throwError(() => error);
          }
          // Mark the cloned request so the interceptor won't retry a second time.
          const retryReq = attachToken(req).clone({
            reportProgress: false,
          });
          (retryReq as any)._retryAttempt = true;
          // Retry the original request exactly once with the fresh token.
          return next(retryReq);
        }),
        // If refresh itself errored (invalid/expired refresh cookie), force logout
        // and propagate the original 401 so callers can react consistently.
        catchError(() => {
          void auth.logout().subscribe();
          return throwError(() => error);
        }),
      );
    }),
  );
};
