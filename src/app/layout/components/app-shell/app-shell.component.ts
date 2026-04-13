import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { animate, style, transition, trigger } from '@angular/animations';

import { AuthService } from '../../../core/auth/auth.service';

interface NavigationItem {
  label: string;
  route: string;
  description: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('routeTransition', [
      transition('* <=> *', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('320ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly router = inject(Router);

  protected readonly isSidebarOpen = signal(false);
  protected readonly pageTitle = signal('Dashboard');
  protected readonly pageDescription = signal(
    'Review your job search performance and stay on top of your next actions.'
  );
  protected readonly todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(new Date());

  protected readonly navigationItems: NavigationItem[] = [
    {
      label: 'Dashboard',
      route: '/app/dashboard',
      description: 'KPIs, trends, and activity'
    },
    {
      label: 'Add Vacancy',
      route: '/app/vacancies/new',
      description: 'Create a new opportunity entry'
    },
    {
      label: 'Applied Vacancies',
      route: '/app/vacancies',
      description: 'Browse and manage all applications'
    }
  ];

  constructor() {
    this.syncPageMeta(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.syncPageMeta(event.urlAfterRedirects);
        this.isSidebarOpen.set(false);
      });
  }

  public toggleSidebar(): void {
    this.isSidebarOpen.update((value) => !value);
  }

  public closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  public logout(): void {
    this.authService.logout();
    this.closeSidebar();
  }

  private syncPageMeta(url: string): void {
    if (url.startsWith('/app/vacancies/new')) {
      this.pageTitle.set('Add Vacancy');
      this.pageDescription.set('Capture a new role and define your tracking strategy from day one.');
      return;
    }

    if (url.startsWith('/app/vacancies/') && url.endsWith('/edit')) {
      this.pageTitle.set('Edit Vacancy');
      this.pageDescription.set('Update key details, process stage, and follow-up actions.');
      return;
    }

    if (url.startsWith('/app/vacancies/') && !url.endsWith('/edit')) {
      this.pageTitle.set('Vacancy Detail');
      this.pageDescription.set('Inspect application history, process status, and contact context.');
      return;
    }

    if (url.startsWith('/app/vacancies')) {
      this.pageTitle.set('Applied Vacancies');
      this.pageDescription.set('Filter, sort, and manage all tracked opportunities.');
      return;
    }

    this.pageTitle.set('Dashboard');
    this.pageDescription.set('Review your job search performance and stay on top of your next actions.');
  }
}
