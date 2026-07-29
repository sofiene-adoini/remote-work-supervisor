import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AutofocusDirective } from '../../../shared/directives/autofocus.directive';

@Component({
  selector: 'app-forgot-password-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AutofocusDirective],
  template: `
    <form class="auth-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="auth-copy">
        <h1>Reset password</h1>
        <p>Enter your work email and we will send a reset link.</p>
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
        @if (showEmailError()) {
          <p id="email-error" class="auth-error" role="alert">Enter a valid work email.</p>
        }
      </div>

      @if (status) {
        <p class="auth-status" role="status">{{ status }}</p>
      }

      @if (submitError) {
        <p class="auth-error" role="alert">{{ submitError }}</p>
      }

      <div class="auth-actions">
        <button class="auth-button" type="submit" [disabled]="form.invalid || loading">
          @if (loading) {
            <span class="auth-spinner" aria-hidden="true"></span>
          }
          Send reset link
        </button>
        <a class="auth-link" routerLink="/login">Back to sign in</a>
      </div>
    </form>
  `,
  styleUrl: '../styles/auth-pages.scss',
})
export class ForgotPasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly notif = inject(NotificationService);

  protected loading = false;
  protected status = '';
  protected submitError = '';

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected showEmailError(): boolean {
    const control = this.form.controls.email;
    return control.invalid && (control.dirty || control.touched);
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid || this.loading) {
      return;
    }

    this.loading = true;
    this.status = '';
    this.submitError = '';

    this.auth
      .forgotPassword(this.form.controls.email.value)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: () => {
          this.status = 'If that email exists, a reset link has been sent.';
          this.notif.success('Check your email inbox for the reset link.', 'Email sent');
        },
        error: (err: any) => {
          const serverMessage = err?.error?.error?.message;
          this.submitError = serverMessage || 'The reset link could not be sent. Try again.';
          this.notif.error(this.submitError, 'Reset password failed');
        },
      });
  }
}
