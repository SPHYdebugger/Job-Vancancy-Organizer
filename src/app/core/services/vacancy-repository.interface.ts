import { Observable } from 'rxjs';

import { Vacancy } from '../models/vacancy.model';

export interface VacancyRepository {
  watchAll(): Observable<Vacancy[]>;
  getAll(): Vacancy[];
  getById(id: string): Vacancy | undefined;
  create(vacancy: Vacancy): void;
  update(id: string, changes: Partial<Vacancy>): void;
  remove(id: string): void;
  replaceAll(vacancies: Vacancy[]): void;
  count(): number;
}
