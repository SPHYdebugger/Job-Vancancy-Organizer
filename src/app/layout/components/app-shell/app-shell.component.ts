import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { interval } from 'rxjs';
import { startWith } from 'rxjs/operators';
import { animate, style, transition, trigger } from '@angular/animations';

import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AppPreloadService } from '../../../core/services/app-preload.service';
import { TranslatePipe } from '../../../shared/pipes/translate.pipe';

interface NavigationItem {
  labelKey: 'layout.nav.dashboard' | 'layout.nav.addVacancy' | 'layout.nav.appliedVacancies';
  route: string;
  descriptionKey: 'layout.nav.dashboardDesc' | 'layout.nav.addVacancyDesc' | 'layout.nav.appliedVacanciesDesc';
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, TranslatePipe],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('routeTransition', [
      transition('* <=> *', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18nService = inject(I18nService);
  private readonly appPreloadService = inject(AppPreloadService);
  protected readonly router = inject(Router);

  protected readonly isSidebarOpen = signal(false);
  protected readonly selectedLanguage = this.i18nService.language;
  protected readonly currentDateTime = signal(this.formatCurrentDateTime(new Date()));
  protected readonly languageToggleFlag = computed(() => (this.selectedLanguage() === 'es' ? '🇬🇧' : '🇪🇸'));
  protected readonly languageToggleAria = computed(() =>
    this.selectedLanguage() === 'es'
      ? `${this.i18nService.translate('common.language')}: ${this.i18nService.translate('common.english')}`
      : `${this.i18nService.translate('common.language')}: ${this.i18nService.translate('common.spanish')}`
  );

  protected readonly navigationItems: NavigationItem[] = [
    {
      labelKey: 'layout.nav.dashboard',
      route: '/app/dashboard',
      descriptionKey: 'layout.nav.dashboardDesc'
    },
    {
      labelKey: 'layout.nav.addVacancy',
      route: '/app/vacancies/new',
      descriptionKey: 'layout.nav.addVacancyDesc'
    },
    {
      labelKey: 'layout.nav.appliedVacancies',
      route: '/app/vacancies',
      descriptionKey: 'layout.nav.appliedVacanciesDesc'
    }
  ];

  constructor() {
    this.appPreloadService.preloadDashboardAssets();

    this.router.events
      .pipe(
        startWith(new NavigationEnd(0, this.router.url, this.router.url)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.isSidebarOpen.set(false);
        }
      });

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.currentDateTime.set(this.formatCurrentDateTime(new Date()));
      });
  }

  public toggleSidebar(): void {
    this.isSidebarOpen.update((value) => !value);
  }

  public closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  public toggleLanguage(): void {
    const nextLanguage = this.selectedLanguage() === 'es' ? 'en' : 'es';
    this.i18nService.setLanguage(nextLanguage);
    this.currentDateTime.set(this.formatCurrentDateTime(new Date()));
  }

  public logout(): void {
    this.authService.logout();
    this.closeSidebar();
  }

  private formatCurrentDateTime(date: Date): string {
    const language = this.selectedLanguage();
    const locale = this.i18nService.locale();

    const weekday = this.capitalizeFirstLetter(
      new Intl.DateTimeFormat(locale, {
        weekday: 'long'
      }).format(date)
    );

    const month = this.capitalizeFirstLetter(
      new Intl.DateTimeFormat(locale, {
        month: 'short'
      }).format(date).replace('.', '')
    );

    const day = new Intl.DateTimeFormat(locale, {
      day: '2-digit'
    }).format(date);

    const time = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(date);

    if (language === 'es') {
      return `${weekday}, ${day} ${month}, ${time}`;
    }

    return `${weekday}, ${month} ${day}, ${time}`;
  }

  private capitalizeFirstLetter(value: string): string {
    if (!value) {
      return value;
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
