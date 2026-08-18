import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AutofocusDirective, LucideEye, LucideEyeOff],
  template: `
    <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="auth-copy">
        <h1>Sign in</h1>
        <p>Access your IO-Watch dashboard.</p>
      </div>

      <div class="auth-field">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          formControlName="email"
          autocomplete="email"
          aria-describedby="email-error"
          appAutofocus
        />
        @if (showError('email')) {
          <p id="email-error" class="auth-error" role="alert">Enter a valid work email.</p>
        }
      </div>

      <div class="auth-field">
        <label for="password">Password</label>
        <div class="password-wrap">
          <input
            id="password"
            [type]="showPassword ? 'text' : 'password'"
            formControlName="password"
            autocomplete="current-password"
            aria-describedby="password-error"
          />
          <button
            class="password-toggle"
            type="button"
            (click)="showPassword = !showPassword"
            [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
            [attr.aria-pressed]="showPassword"
          >
            @if (showPassword) {
              <svg lucideEyeOff class="pw-icon" aria-hidden="true"></svg>
            } @else {
              <svg lucideEye class="pw-icon" aria-hidden="true"></svg>
            }
          </button>
        </div>
        @if (showError('password')) {
          <p id="password-error" class="auth-error" role="alert">Enter your password.</p>
        }
      </div>

      @if (submitError) {
        <p class="auth-error" role="alert">{{ submitError }}</p>
      }

      <div class="auth-actions">
        <button class="auth-button" type="submit" [disabled]="form.invalid || loading">
          @if (loading) {
            <span class="auth-spinner" aria-hidden="true"></span>
          }
          Sign in
        </button>
        <a class="auth-link" routerLink="/forgot-password">Forgot password?</a>
      </div>
    </form>
  `,
  styleUrl: '../styles/auth-pages.scss',
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notif = inject(NotificationService);

  protected loading = false;
  protected submitError = '';
  protected showPassword = false;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected showError(controlName: 'email' | 'password'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.dirty || control.touched);
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.submitError = '';

    const { email, password } = this.form.getRawValue();
    this.auth
      .login(email, password)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (user) => void this.router.navigateByUrl(this.auth.redirectPathFor(user)),
        error: (err: any) => {
          const serverMessage = err?.error?.error?.message;
          this.submitError = serverMessage || "That email or password isn't right. Try again.";
          this.notif.error(this.submitError, 'Sign in failed');
        },
      });
  }
}
