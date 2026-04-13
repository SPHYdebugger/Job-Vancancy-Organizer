import { InjectionToken } from '@angular/core';

import { VacancyRepository } from './vacancy-repository.interface';

export const VACANCY_REPOSITORY = new InjectionToken<VacancyRepository>('VACANCY_REPOSITORY');
