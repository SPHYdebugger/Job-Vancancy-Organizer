import {
  APP_INITIALIZER,
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';

import { VACANCY_REPOSITORY } from './core/services/vacancy-repository.token';
import { LocalVacancyRepository } from './features/vacancies/services/local-vacancy.repository';
import { VacancySeedService } from './features/vacancies/services/vacancy-seed.service';
import { routes } from './app.routes';

function initializeVacancySeed(vacancySeedService: VacancySeedService): () => Promise<void> {
  return () => vacancySeedService.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAnimationsAsync(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(),
    {
      provide: VACANCY_REPOSITORY,
      useClass: LocalVacancyRepository
    },
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: initializeVacancySeed,
      deps: [VacancySeedService]
    }
  ]
};
