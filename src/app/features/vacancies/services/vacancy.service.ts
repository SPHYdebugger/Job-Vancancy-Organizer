import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Vacancy } from '../../../core/models/vacancy.model';
import { VACANCY_REPOSITORY } from '../../../core/services/vacancy-repository.token';

@Injectable({
  providedIn: 'root'
})
export class VacancyService {
  private readonly vacancyRepository = inject(VACANCY_REPOSITORY);

  public watchAll(): Observable<Vacancy[]> {
    return this.vacancyRepository.watchAll();
  }

  public getAll(): Vacancy[] {
    return this.vacancyRepository.getAll();
  }

  public getById(id: string): Vacancy | undefined {
    return this.vacancyRepository.getById(id);
  }

  public create(vacancy: Vacancy): void {
    this.vacancyRepository.create(vacancy);
  }

  public update(id: string, changes: Partial<Vacancy>): void {
    this.vacancyRepository.update(id, changes);
  }

  public remove(id: string): void {
    this.vacancyRepository.remove(id);
  }
}
