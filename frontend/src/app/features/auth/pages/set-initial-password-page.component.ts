import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { matchingPasswords, passwordStrength } from './auth-form.helpers';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-set-initial-password-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AutofocusDirective],
  template: `
    <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="auth-copy">
        <h1>Set your password</h1>
        <p>Welcome. Create a password to activate your account.</p>
      </div>

      <div class="auth-field">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          formControlName="password"
          autocomplete="new-password"
          aria-describedby="password-error"
          appAutofocus
        />
        @if (showPasswordError()) {
          <p id="password-error" class="auth-error" role="alert">Use at least 10 characters and one number.</p>
        }
      </div>

      <div class="auth-field">
        <label for="passwordConfirmation">Confirm password</label>
        <input
          id="passwordConfirmation"
          type="password"
          formControlName="passwordConfirmation"
          autocomplete="new-password"
          aria-describedby="passwordConfirmation-error"
        />
        @if (showConfirmError()) {
          <p id="passwordConfirmation-error" class="auth-error" role="alert">Passwords must match.</p>
        }
      </div>

      @if (submitError) {
        <p class="auth-error" role="alert">{{ submitError }}</p>
      }

      <div class="auth-actions">
        <button class="auth-button" type="submit" [disabled]="form.invalid || loading || !token">
          @if (loading) {
            <span class="auth-spinner" aria-hidden="true"></span>
          }
          Set password
        </button>
        <a class="auth-link" routerLink="/login">Back to sign in</a>
      </div>
    </form>
  `,
  styleUrl: '../styles/auth-pages.scss',
})
export class SetInitialPasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected loading = false;
  protected submitError = '';
  protected readonly token = this.route.snapshot.queryParamMap.get('code') ?? this.route.snapshot.queryParamMap.get('token');

  protected readonly form = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, passwordStrength]],
      passwordConfirmation: ['', [Validators.required]],
    },
    { validators: matchingPasswords },
  );

  protected showPasswordError(): boolean {
    const control = this.form.controls.password;
    return control.invalid && (control.dirty || control.touched);
  }

  protected showConfirmError(): boolean {
    const control = this.form.controls.passwordConfirmation;
    return (
      (control.invalid || this.form.hasError('passwordMismatch')) &&
      (control.dirty || control.touched)
    );
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.loading || !this.token) {
      this.submitError = !this.token ? 'The invite link is missing its token.' : '';
      return;
    }

    this.loading = true;
    this.submitError = '';

    const { password, passwordConfirmation } = this.form.getRawValue();
    this.auth
      .setInitialPassword(this.token, password, passwordConfirmation)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (user) => void this.router.navigateByUrl(this.auth.redirectPathFor(user)),
        error: () => {
          this.submitError = 'This invite link is invalid or expired. Contact HR for a new invite.';
        },
      });
  }
}
