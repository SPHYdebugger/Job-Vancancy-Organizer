import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss'
})
export class LoginPageComponent {
  constructor(
    private readonly router: Router,
    private readonly authService: AuthService
  ) {}

  public loginDemoUser(): void {
    this.authService.login('demo.backend');
    void this.router.navigate(['/app/dashboard']);
  }
}
