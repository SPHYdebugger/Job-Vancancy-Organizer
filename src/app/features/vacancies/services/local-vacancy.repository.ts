import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { Vacancy } from '../../../core/models/vacancy.model';
import { StorageService } from '../../../core/services/storage.service';
import { VacancyRepository } from '../../../core/services/vacancy-repository.interface';

const STORAGE_KEY = 'jvo.vacancies';

@Injectable()
export class LocalVacancyRepository implements VacancyRepository {
  private readonly vacanciesSubject: BehaviorSubject<Vacancy[]>;

  constructor(private readonly storageService: StorageService) {
    const persistedVacancies = this.storageService.getItem<Vacancy[]>(STORAGE_KEY) ?? [];
    this.vacanciesSubject = new BehaviorSubject<Vacancy[]>(persistedVacancies);
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
    const updatedVacancies = [vacancy, ...this.vacanciesSubject.value];
    this.commit(updatedVacancies);
  }

  public update(id: string, changes: Partial<Vacancy>): void {
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
    const updatedVacancies = this.vacanciesSubject.value.filter((vacancy) => vacancy.id !== id);
    this.commit(updatedVacancies);
  }

  public replaceAll(vacancies: Vacancy[]): void {
    this.commit(vacancies);
  }

  public count(): number {
    return this.vacanciesSubject.value.length;
  }

  private commit(vacancies: Vacancy[]): void {
    this.storageService.setItem(STORAGE_KEY, vacancies);
    this.vacanciesSubject.next(vacancies);
  }
}
