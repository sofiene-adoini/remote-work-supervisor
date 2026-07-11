import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const passwordStrength: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  return /^(?=.*\d).{10,}$/.test(value) ? null : { passwordStrength: true };
};

export const matchingPasswords: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const passwordConfirmation = control.get('passwordConfirmation')?.value;

  return password && passwordConfirmation && password !== passwordConfirmation
    ? { passwordMismatch: true }
    : null;
};
