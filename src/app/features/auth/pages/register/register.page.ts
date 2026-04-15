import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { TranslationKey } from '../../../../core/i18n/translations';

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    TranslatePipe
  ],
  templateUrl: './register.page.html',
  styleUrl: './register.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly i18nService = inject(I18nService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly isSubmitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly hidePassword = signal(true);
  protected readonly hideConfirmPassword = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly registerForm = this.formBuilder.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
    },
    {
      validators: [this.matchPasswordsValidator]
    }
  );

  protected readonly nameControl = this.registerForm.controls.name;
  protected readonly emailControl = this.registerForm.controls.email;
  protected readonly passwordControl = this.registerForm.controls.password;
  protected readonly confirmPasswordControl = this.registerForm.controls.confirmPassword;

  protected submit(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.registerForm.getRawValue();

    const registerResult = this.authService.register({
      name: formValue.name,
      email: formValue.email,
      password: formValue.password
    });

    if (!registerResult.success) {
      this.errorMessage.set(
        this.i18nService.translate((registerResult.messageKey ?? 'auth.register.unexpectedError') as TranslationKey)
      );
      this.isSubmitting.set(false);
      return;
    }

    this.snackBar.open(
      this.i18nService.translate('auth.register.success'),
      this.i18nService.translate('common.close'),
      { duration: 3200 }
    );

    void this.router.navigate(['/auth/login']);
  }

  protected shouldShowError(controlName: 'name' | 'email' | 'password' | 'confirmPassword'): boolean {
    const control = this.registerForm.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  protected hasPasswordMismatch(): boolean {
    return (
      this.registerForm.hasError('passwordMismatch') &&
      (this.confirmPasswordControl.touched || this.submitted())
    );
  }

  protected togglePasswordVisibility(): void {
    this.hidePassword.update((value) => !value);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword.update((value) => !value);
  }

  private matchPasswordsValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value as string | undefined;
    const confirmPassword = group.get('confirmPassword')?.value as string | undefined;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}
