import { Routes } from '@angular/router';

export const VACANCIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/vacancies-list/vacancies-list.page').then((m) => m.VacanciesListPageComponent)
  },
  {
    path: 'new',
    loadComponent: () => import('./pages/vacancy-form/vacancy-form.page').then((m) => m.VacancyFormPageComponent)
  },
  {
    path: ':id',
    loadComponent: () => import('./pages/vacancy-detail/vacancy-detail.page').then((m) => m.VacancyDetailPageComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./pages/vacancy-form/vacancy-form.page').then((m) => m.VacancyFormPageComponent)
  }
];
