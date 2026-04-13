import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';

interface NavigationItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  protected readonly navigationItems: NavigationItem[] = [
    { label: 'Dashboard', route: '/app/dashboard' },
    { label: 'Add Vacancy', route: '/app/vacancies/new' },
    { label: 'Applied Vacancies', route: '/app/vacancies' }
  ];

  constructor(private readonly authService: AuthService) {}

  public logout(): void {
    this.authService.logout();
  }
}
