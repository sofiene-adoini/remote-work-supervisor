import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  template: `
    <form class="login-form" [formGroup]="form" novalidate>
      <h1>Sign In</h1>
      <p>Access the Remote Work Supervisor dashboard.</p>

      <mat-form-field appearance="outline">
        <mat-label>Email</mat-label>
        <input matInput type="email" formControlName="email" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Password</mat-label>
        <input matInput type="password" formControlName="password" />
      </mat-form-field>

      <button mat-flat-button color="primary" type="button">Login</button>
    </form>
  `,
  styles: [
    `
      .login-form {
        display: grid;
        gap: 1rem;
        padding: 1.5rem;
      }

      h1 {
        margin: 0;
        font-size: 1.5rem;
      }

      p {
        margin: 0;
        color: #5f6b78;
      }
    `,
  ],
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
}
