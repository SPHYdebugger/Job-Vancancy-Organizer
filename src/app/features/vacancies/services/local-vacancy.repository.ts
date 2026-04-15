import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { Vacancy } from '../../../core/models/vacancy.model';
import { StorageService } from '../../../core/services/storage.service';
import { VacancyRepository } from '../../../core/services/vacancy-repository.interface';
import { LEGACY_VACANCY_STORAGE_KEY, VACANCIES_BY_USER_STORAGE_KEY } from './vacancy-storage.constants';

@Injectable()
export class LocalVacancyRepository implements VacancyRepository {
  private readonly vacanciesSubject: BehaviorSubject<Vacancy[]>;
  private currentUserId: string | null = null;

  constructor(
    private readonly storageService: StorageService,
    private readonly authService: AuthService
  ) {
    this.migrateLegacyStorage();
    this.currentUserId = this.authService.getCurrentUserId();
    this.vacanciesSubject = new BehaviorSubject<Vacancy[]>(this.readCurrentUserVacancies());

    this.authService.session$.subscribe((session) => {
      this.currentUserId = session?.userId ?? null;
      this.vacanciesSubject.next(this.readCurrentUserVacancies());
    });
  }

  public watchAll(): Observable<Vacancy[]> {
    return this.vacanciesSubject.asObservable();
  }

  public getAll(): Vacancy[] {
    return this.vacanciesSubject.value;
  }

  public getById(id: string): Vacancy | undefined {
    return this.vacanciesSubject.value.find((vacancy) => vacancy.id === id);
  }

  public create(vacancy: Vacancy): void {
    if (!this.currentUserId) {
      return;
    }

    const updatedVacancies = [vacancy, ...this.vacanciesSubject.value];
    this.commit(updatedVacancies);
  }

  public update(id: string, changes: Partial<Vacancy>): void {
    if (!this.currentUserId) {
      return;
    }

    const updatedVacancies = this.vacanciesSubject.value.map((vacancy) => {
      if (vacancy.id !== id) {
        return vacancy;
      }

      return {
        ...vacancy,
        ...changes,
        id: vacancy.id,
        lastUpdatedAt: changes.lastUpdatedAt ?? new Date().toISOString()
      };
    });

    this.commit(updatedVacancies);
  }

  public remove(id: string): void {
    if (!this.currentUserId) {
      return;
    }

    const updatedVacancies = this.vacanciesSubject.value.filter((vacancy) => vacancy.id !== id);
    this.commit(updatedVacancies);
  }

  public replaceAll(vacancies: Vacancy[]): void {
    if (!this.currentUserId) {
      return;
    }

    this.commit(vacancies);
  }

  public count(): number {
    return this.vacanciesSubject.value.length;
  }

  private commit(vacancies: Vacancy[]): void {
    if (!this.currentUserId) {
      return;
    }

    const vacanciesByUser = this.readVacanciesByUser();
    vacanciesByUser[this.currentUserId] = vacancies;
    this.storageService.setItem(VACANCIES_BY_USER_STORAGE_KEY, vacanciesByUser);
    this.vacanciesSubject.next(vacancies);
  }

  private readCurrentUserVacancies(): Vacancy[] {
    if (!this.currentUserId) {
      return [];
    }

    const vacanciesByUser = this.readVacanciesByUser();
    return vacanciesByUser[this.currentUserId] ?? [];
  }

  private readVacanciesByUser(): Record<string, Vacancy[]> {
    return this.storageService.getItem<Record<string, Vacancy[]>>(VACANCIES_BY_USER_STORAGE_KEY) ?? {};
  }

  private migrateLegacyStorage(): void {
    const legacyVacancies = this.storageService.getItem<Vacancy[]>(LEGACY_VACANCY_STORAGE_KEY) ?? [];
    if (legacyVacancies.length === 0) {
      return;
    }

    const demoUserId = environment.auth.demoUser.username.trim().toLowerCase();
    const vacanciesByUser = this.readVacanciesByUser();

    if (!vacanciesByUser[demoUserId] || vacanciesByUser[demoUserId].length === 0) {
      vacanciesByUser[demoUserId] = legacyVacancies;
      this.storageService.setItem(VACANCIES_BY_USER_STORAGE_KEY, vacanciesByUser);
    }

    this.storageService.removeItem(LEGACY_VACANCY_STORAGE_KEY);
  }
}
