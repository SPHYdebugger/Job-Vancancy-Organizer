import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

import { Vacancy } from '../../../core/models/vacancy.model';
import { StorageService } from '../../../core/services/storage.service';
import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import {
  DEMO_SEED_REFRESH_DATE_KEY,
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
      const today = new Date();
      const refreshDate = toLocalDateKey(today);
      const lastRefreshDate = this.storageService.getItem<string>(DEMO_SEED_REFRESH_DATE_KEY);

      const vacanciesByUser = this.storageService.getItem<Record<string, Vacancy[]>>(VACANCIES_BY_USER_STORAGE_KEY) ?? {};
      const eventsByUser =
        this.storageService.getItem<Record<string, VacancyEvent[]>>(VACANCY_EVENTS_BY_USER_STORAGE_KEY) ?? {};
      const followUpsByUser =
        this.storageService.getItem<Record<string, VacancyFollowUp[]>>(VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY) ?? {};

      if (lastRefreshDate === refreshDate && (vacanciesByUser[DEMO_USER_ID]?.length ?? 0) > 0) {
        return;
      }

      const seedVacancies = await firstValueFrom(
        this.httpClient.get<Vacancy[]>('assets/mocks/vacancies.seed.json')
      );

      const normalizedVacancies = seedVacancies
        .map((vacancy) => this.ensureFakeMarker(vacancy))
        .map((vacancy) => normalizeVacancy(vacancy as Partial<Vacancy> & Record<string, unknown>));
      const dynamicVacancies = buildDynamicDemoVacancies(normalizedVacancies, today);

      const seededEvents = dynamicVacancies.map((vacancy) => createDefaultEvent(vacancy, DEMO_USER_ID));
      const seededFollowUps = dynamicVacancies
        .map((vacancy) => createFollowUpFromVacancy(vacancy))
        .filter((followUp): followUp is VacancyFollowUp => Boolean(followUp));

      vacanciesByUser[DEMO_USER_ID] = dynamicVacancies;
      eventsByUser[DEMO_USER_ID] = seededEvents;
      followUpsByUser[DEMO_USER_ID] = seededFollowUps;
      this.storageService.setItem(VACANCIES_BY_USER_STORAGE_KEY, vacanciesByUser);
      this.storageService.setItem(VACANCY_EVENTS_BY_USER_STORAGE_KEY, eventsByUser);
      this.storageService.setItem(VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY, followUpsByUser);
      this.storageService.setItem(SEED_FLAG_KEY, true);
      this.storageService.setItem(DEMO_SEED_REFRESH_DATE_KEY, refreshDate);
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

type DemoWeekOffset = -2 | -1 | 0;

/**
 * Rebase demo records around the current week. The same date and vacancy IDs always
 * produce the same result, so refreshing the browser does not make charts jump.
 */
export function buildDynamicDemoVacancies(vacancies: Vacancy[], now: Date): Vacancy[] {
  const bucketCounts = allocateBuckets(vacancies.length, [0.3, 0.2, 0.5]);
  const weekOffsets: DemoWeekOffset[] = [
    ...Array<DemoWeekOffset>(bucketCounts[0]).fill(-2),
    ...Array<DemoWeekOffset>(bucketCounts[1]).fill(-1),
    ...Array<DemoWeekOffset>(bucketCounts[2]).fill(0)
  ];
  const dailySeed = toLocalDateKey(now);

  return vacancies.map((vacancy, index) => {
    const weekOffset = weekOffsets[index] ?? 0;
    const applicationAt = buildApplicationDate(vacancy.id, weekOffset, now, dailySeed);
    const elapsedMs = Math.max(0, now.getTime() - applicationAt.getTime());
    const updateRatio = 0.25 + (stableHash(`${vacancy.id}:${dailySeed}:update`) % 70) / 100;
    const updatedAt = new Date(applicationAt.getTime() + elapsedMs * updateRatio);
    const discoveredAt = new Date(applicationAt);
    discoveredAt.setDate(discoveredAt.getDate() - 1 - (stableHash(`${vacancy.id}:discovered`) % 3));
    const nextFollowUpDate = vacancy.followUpPending
      ? addLocalDays(now, 1 + (stableHash(`${vacancy.id}:${dailySeed}:follow-up`) % 7))
      : null;

    return {
      ...vacancy,
      createdAt: discoveredAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      discoveredAt: discoveredAt.toISOString(),
      applicationDate: toLocalDateKey(applicationAt),
      lastContactAt: vacancy.lastContactAt ? updatedAt.toISOString() : null,
      lastStatusChangeAt: updatedAt.toISOString(),
      nextFollowUpDate,
      archivedAt: vacancy.archivedAt ? updatedAt.toISOString() : null,
      closedAt: vacancy.closedAt ? updatedAt.toISOString() : null
    };
  });
}

function allocateBuckets(total: number, ratios: number[]): number[] {
  const exact = ratios.map((ratio) => ratio * total);
  const counts = exact.map(Math.floor);
  const remaining = total - counts.reduce((sum, count) => sum + count, 0);
  const remainderOrder = exact
    .map((value, index) => ({ index, remainder: value - counts[index] }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);

  for (let index = 0; index < remaining; index += 1) {
    counts[remainderOrder[index].index] += 1;
  }

  return counts;
}

function buildApplicationDate(id: string, weekOffset: DemoWeekOffset, now: Date, dailySeed: string): Date {
  const weekStart = startOfLocalWeek(now);
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const maximumDay = weekOffset === 0 ? (now.getDay() + 6) % 7 : 6;
  const dayOffset = stableHash(`${id}:${dailySeed}:day`) % (maximumDay + 1);
  const hour = 8 + (stableHash(`${id}:hour`) % 10);
  const minute = stableHash(`${id}:minute`) % 60;
  const result = new Date(weekStart);
  result.setDate(result.getDate() + dayOffset);
  result.setHours(hour, minute, 0, 0);

  return result.getTime() > now.getTime() ? new Date(now) : result;
}

function startOfLocalWeek(date: Date): Date {
  const result = new Date(date);
  const dayFromMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - dayFromMonday);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addLocalDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return toLocalDateKey(result);
}

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
