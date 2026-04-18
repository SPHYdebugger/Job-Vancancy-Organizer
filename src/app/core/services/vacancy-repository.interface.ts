import { Observable } from 'rxjs';

import { Vacancy } from '../models/vacancy.model';
import { VacancyEvent } from '../models/vacancy-event.model';
import { VacancyFollowUp } from '../models/vacancy-followup.model';
import { DashboardPreAggregates } from '../models/dashboard-pre-aggregates.model';

export interface ReadModelState {
  vacancies: Vacancy[];
  events: VacancyEvent[];
  followUps: VacancyFollowUp[];
  preAggregates: DashboardPreAggregates;
}

export interface VacancyRepository {
  watchReadModel(): Observable<ReadModelState>;
  watchEvents(vacancyId?: string): Observable<VacancyEvent[]>;
  watchFollowUps(vacancyId?: string): Observable<VacancyFollowUp[]>;
  getAll(): Vacancy[];
  getById(id: string): Vacancy | undefined;
  getEvents(vacancyId?: string): VacancyEvent[];
  getFollowUps(vacancyId?: string): VacancyFollowUp[];
  getDashboardPreAggregates(): DashboardPreAggregates;
  create(vacancy: Vacancy): void;
  createFollowUp(followUp: VacancyFollowUp): void;
  updateFollowUp(id: string, changes: Partial<VacancyFollowUp>): void;
  removeFollowUp(id: string): void;
  update(id: string, changes: Partial<Vacancy>, options?: { recordSystemEvent?: boolean }): void;
  createEvent(event: VacancyEvent): void;
  updateEvent(id: string, changes: Partial<VacancyEvent>): void;
  removeEvent(id: string): void;
  remove(id: string): void;
  replaceAll(vacancies: Vacancy[]): void;
  count(): number;
}
