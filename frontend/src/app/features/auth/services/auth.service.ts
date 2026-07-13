import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, catchError, finalize, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { API_BASE_PATH } from '../../../core/constants/app.constants';
import { AuthResponse, CurrentUser, InviteRequest } from '../models/auth.models';

/**
 * Header instructing Strapi to issue/renew the refresh token as an httpOnly cookie
 * (rather than returning it in the JSON body), so JavaScript cannot read it directly.
 */
const REFRESH_HEADERS = new HttpHeaders({ 'x-strapi-refresh-cookie': 'httpOnly' });

/**
 * sessionStorage is used only to survive a full page refresh within the same tab /
 * browser session — NOT to persist auth across sessions (that's what the httpOnly
 * cookie is for). sessionStorage is emptied when the tab closes, so a forgotten login
 * in a shared browser tab doesn't survive beyond the session. The opaque refresh
 * token itself lives entirely in the httpOnly cookie set by the backend.
 *
 * Tradeoff: keeping the access JWT in-memory + sessionStorage this way means a page
 * reload triggers a silent refresh (one extra round-trip) but prevents the long-lived
 * access token from sitting readable in localStorage for any XSS payload to exfiltrate.
 * See `docs/auth-security-notes.md` for the full tradeoff analysis.
 */
const ACCESS_TOKEN_SESSION_KEY = 'rws.access-token';
const USER_SESSION_KEY = 'rws.current-user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly currentUserSubject = new BehaviorSubject<CurrentUser | null>(
    this.readUserFromSession(),
  );
  private accessToken: string | null = this.readTokenFromSession();

  /**
   * Serializes concurrent refresh attempts: when multiple 401s arrive simultaneously
   * the first one kicks off a refresh; all other callers share the same in-flight
   * Observable instead of triggering N parallel /auth/refresh calls.
   */
  private refreshInFlight: Observable<string | null> | null = null;

  readonly currentUser$ = this.currentUserSubject.asObservable();

  get token(): string | null {
    return this.accessToken;
  }

  get currentUser(): CurrentUser | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken && !!this.currentUserSubject.value;
  }

  login(email: string, password: string): Observable<CurrentUser> {
    return this.http
      .post<AuthResponse>(
        `${API_BASE_PATH}/auth/local`,
        { identifier: email, password },
        { headers: REFRESH_HEADERS, withCredentials: true },
      )
      .pipe(switchMap((response) => this.applyAuthResponse(response)));
  }

  forgotPassword(email: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${API_BASE_PATH}/auth/forgot-password`, { email });
  }

  resetPassword(code: string, password: string, passwordConfirmation: string): Observable<CurrentUser> {
    return this.http
      .post<AuthResponse>(
        `${API_BASE_PATH}/auth/reset-password`,
        { code, password, passwordConfirmation },
        { headers: REFRESH_HEADERS, withCredentials: true },
      )
      .pipe(switchMap((response) => this.applyAuthResponse(response)));
  }

  setInitialPassword(code: string, password: string, passwordConfirmation: string): Observable<CurrentUser> {
    return this.resetPassword(code, password, passwordConfirmation);
  }

  invite(payload: InviteRequest): Observable<{ user: CurrentUser; inviteToken: string }> {
    return this.http.post<{ user: CurrentUser; inviteToken: string }>(
      `${API_BASE_PATH}/auth/invite`,
      payload,
    );
  }

  /**
   * Restores the in-memory session from sessionStorage (only survives a reload in the
   * same tab). If we have a stored user but no usable access token, attempt a silent
   * refresh via the httpOnly cookie before giving up — this is the common path after
   * an F5, since the access JWT is short-lived (1h) and may already be expired.
   */
  restoreSession(): Observable<CurrentUser | null> {
    const storedUser = this.currentUserSubject.value;
    const storedToken = this.accessToken;

    if (storedUser && storedToken) {
      return of(storedUser);
    }

    // We have a user cached but the access token may have expired on reload.
    // Try a silent refresh before deciding the session is dead.
    return this.refreshToken().pipe(
      switchMap((newToken) => {
        if (!newToken) {
          // No refresh cookie / refresh failed — treat session as terminated.
          this.clearLocalSession();
          return of(null);
        }
        // After a successful refresh, currentUserSubject now holds the full
        // profile (with role + team) loaded by refreshToken → loadCurrentUser().
        return of(this.currentUserSubject.value);
      }),
    );
  }

  /**
   * Calls Strapi's built-in `/auth/refresh` with `withCredentials: true` so the
   * httpOnly cookie is automatically sent by the browser. The refreshed access JWT
   * is held in memory only; the new refresh cookie is set by the server.
   * Returns the new access token (or null on failure).
   *
   * Concurrent callers share the same in-flight request via `refreshInFlight`.
   */

  refreshToken(): Observable<string | null> {
  if (this.refreshInFlight) {
    return this.refreshInFlight;
  }

  this.refreshInFlight = this.http
    .post<AuthResponse>(
      `${API_BASE_PATH}/auth/refresh`,
      {},
      { headers: REFRESH_HEADERS, withCredentials: true },
    )
    .pipe(
      tap((response) => {
        if (response?.jwt) {
          this.accessToken = response.jwt;
          this.writeTokenToSession(response.jwt);
        }
      }),
      switchMap((response) => {
        if (!response?.jwt) {
          return of(null);
        }
        // Strapi's /auth/refresh returns a user object without populated
        // relations (role, team). Fetch the full profile from /auth/me.
        return this.loadCurrentUser().pipe(
          switchMap(() => of(response.jwt)),
          catchError(() => of(response.jwt)),
        );
      }),
      catchError(() => of(null)),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay(1),
    );

  return this.refreshInFlight;
}

  /** The interceptor uses this to detect an already-in-flight refresh and avoid re-entry. */
  get refreshInProgress(): boolean {
    return this.refreshInFlight !== null;
  }

  loadCurrentUser(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(`${API_BASE_PATH}/auth/me`, { withCredentials: true }).pipe(
      tap((user) => {
        this.currentUserSubject.next(user);
        this.writeUserToSession(user);
      }),
      catchError((error: any) => {
        // If we get a 401, the session is invalid. Clear local state and propagate error.
        // This prevents the auth interceptor from triggering another refresh cycle.
        if (error?.status === 401) {
          this.clearLocalSession();
          this.accessToken = null;
          this.currentUserSubject.next(null);
        }
        return throwError(() => error);
      }),
    );
  }

  logout(): Observable<void> {
    // Tell Strapi to invalidate the refresh cookie server-side. Best-effort: even on
    // network failure we still clear the local session and navigate to /login.
    return this.http.post(`${API_BASE_PATH}/auth/logout`, {}, { withCredentials: true }).pipe(
      finalize(() => {
        this.accessToken = null;
        this.currentUserSubject.next(null);
        this.clearLocalSession();
        void this.router.navigate(['/login']);
      }),
      switchMap(() => of(void 0)),
      // On network error the finalize above still clears the session because
      // finalize fires on both next and error.
    );
  }

  redirectPathFor(user: CurrentUser | null = this.currentUser): string {
    const roleName = user?.role?.name;
    return roleName === 'HR' || roleName === 'Admin' ? '/hr/dashboard' : '/employee/dashboard';
  }

  private applyAuthResponse(response: AuthResponse): Observable<CurrentUser> {
    if (response.jwt) {
      this.accessToken = response.jwt;
      this.writeTokenToSession(response.jwt);
    }

    // Strapi's built-in /auth/local and /auth/reset-password callbacks return a
    // sanitized user object WITHOUT populated relations (role, team). Store it
    // immediately so the UI can render, then fetch the full profile from /auth/me.
    if (response.user) {
      this.currentUserSubject.next(response.user);
      this.writeUserToSession(response.user);
    }

    return this.loadCurrentUser();
  }

  private clearLocalSession(): void {
    try {
      sessionStorage.removeItem(ACCESS_TOKEN_SESSION_KEY);
      sessionStorage.removeItem(USER_SESSION_KEY);
    } catch {
      // sessionStorage may throw in private mode / sandboxed contexts — ignore.
    }
  }

  private writeTokenToSession(token: string): void {
    try {
      sessionStorage.setItem(ACCESS_TOKEN_SESSION_KEY, token);
    } catch {
      // ignore — in-memory copy is the source of truth.
    }
  }

  private writeUserToSession(user: CurrentUser): void {
    try {
      sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
    } catch {
      // ignore — in-memory copy is the source of truth.
    }
  }

  private readTokenFromSession(): string | null {
    try {
      return sessionStorage.getItem(ACCESS_TOKEN_SESSION_KEY);
    } catch {
      return null;
    }
  }

  private readUserFromSession(): CurrentUser | null {
    try {
      const raw = sessionStorage.getItem(USER_SESSION_KEY);
      return raw ? (JSON.parse(raw) as CurrentUser) : null;
    } catch {
      return null;
    }
  }
}
