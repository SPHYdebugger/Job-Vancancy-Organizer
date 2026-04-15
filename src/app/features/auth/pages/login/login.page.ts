import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../../core/i18n/translations';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    TranslatePipe
  ],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly i18nService = inject(I18nService);

  protected readonly isSubmitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly demoUsername = environment.auth.demoUser.username;
  protected readonly demoPassword = environment.auth.demoUser.password;
  protected readonly hidePassword = signal(true);

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(4)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    rememberSession: [true]
  });

  protected readonly usernameControl = this.loginForm.controls.username;
  protected readonly passwordControl = this.loginForm.controls.password;

  constructor(
    private readonly router: Router,
    private readonly route: ActivatedRoute,
    private readonly authService: AuthService
  ) {}

  public submit(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    const loginResult = this.authService.login({
      username: this.usernameControl.value,
      password: this.passwordControl.value,
      rememberSession: this.loginForm.controls.rememberSession.value
    });

    if (!loginResult.success) {
      this.errorMessage.set(
        loginResult.messageKey
          ? this.i18nService.translate(loginResult.messageKey as TranslationKey)
          : this.i18nService.translate('auth.login.unexpectedError')
      );
      this.isSubmitting.set(false);
      return;
    }

    const redirectUrl = this.route.snapshot.queryParamMap.get('redirectUrl');
    const destination = redirectUrl?.startsWith('/app') ? redirectUrl : '/app/dashboard';
    void this.router.navigateByUrl(destination);
  }

  public fillDemoCredentials(): void {
    this.loginForm.patchValue({
      username: this.demoUsername,
      password: this.demoPassword
    });
    this.errorMessage.set(null);
  }

  public togglePasswordVisibility(): void {
    this.hidePassword.update((value) => !value);
  }

  protected shouldShowError(controlName: 'username' | 'password'): boolean {
    const control = this.loginForm.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }
}
