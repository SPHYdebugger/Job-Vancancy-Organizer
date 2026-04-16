import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

import { Vacancy } from '../../../core/models/vacancy.model';
import { StorageService } from '../../../core/services/storage.service';
import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import {
  SEED_FLAG_KEY,
  VACANCIES_BY_USER_STORAGE_KEY,
  VACANCY_EVENTS_BY_USER_STORAGE_KEY,
  VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY
} from './vacancy-storage.constants';
import { createDefaultEvent, createFollowUpFromVacancy, normalizeVacancy } from './vacancy-normalizer';

const DEMO_USER_ID = environment.auth.demoUser.username.trim().toLowerCase();

@Injectable({
  providedIn: 'root'
})
export class VacancySeedService {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly storageService: StorageService
  ) {}

  public async initialize(): Promise<void> {
    try {
      const isSeedCompleted = this.storageService.getItem<boolean>(SEED_FLAG_KEY) ?? false;

      const vacanciesByUser = this.storageService.getItem<Record<string, Vacancy[]>>(VACANCIES_BY_USER_STORAGE_KEY) ?? {};
      const eventsByUser =
        this.storageService.getItem<Record<string, VacancyEvent[]>>(VACANCY_EVENTS_BY_USER_STORAGE_KEY) ?? {};
      const followUpsByUser =
        this.storageService.getItem<Record<string, VacancyFollowUp[]>>(VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY) ?? {};

      if (isSeedCompleted && (vacanciesByUser[DEMO_USER_ID]?.length ?? 0) > 0) {
        return;
      }

      const seedVacancies = await firstValueFrom(
        this.httpClient.get<Vacancy[]>('assets/mocks/vacancies.seed.json')
      );

      const normalizedVacancies = seedVacancies
        .map((vacancy) => this.ensureFakeMarker(vacancy))
        .map((vacancy) => normalizeVacancy(vacancy as Partial<Vacancy> & Record<string, unknown>));

      const seededEvents = normalizedVacancies.map((vacancy) => createDefaultEvent(vacancy, DEMO_USER_ID));
      const seededFollowUps = normalizedVacancies
        .map((vacancy) => createFollowUpFromVacancy(vacancy))
        .filter((followUp): followUp is VacancyFollowUp => Boolean(followUp));

      vacanciesByUser[DEMO_USER_ID] = normalizedVacancies;
      eventsByUser[DEMO_USER_ID] = seededEvents;
      followUpsByUser[DEMO_USER_ID] = seededFollowUps;
      this.storageService.setItem(VACANCIES_BY_USER_STORAGE_KEY, vacanciesByUser);
      this.storageService.setItem(VACANCY_EVENTS_BY_USER_STORAGE_KEY, eventsByUser);
      this.storageService.setItem(VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY, followUpsByUser);
      this.storageService.setItem(SEED_FLAG_KEY, true);
    } catch (error) {
      console.error('Vacancy seed initialization failed. App will continue without seeding.', error);
    }
  }

  private ensureFakeMarker(vacancy: Vacancy): Vacancy {
    const fakeCompany = vacancy.company.includes('FAKE') ? vacancy.company : `FAKE ${vacancy.company}`;
    const fakePosition = vacancy.position.includes('FAKE')
      ? vacancy.position
      : `[FAKE] ${vacancy.position}`;

    return {
      ...vacancy,
      company: fakeCompany,
      position: fakePosition
    };
  }
}
