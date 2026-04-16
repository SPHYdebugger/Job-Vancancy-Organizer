import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import { Vacancy } from '../../../core/models/vacancy.model';
import { StorageService } from '../../../core/services/storage.service';
import { VacancyRepository } from '../../../core/services/vacancy-repository.interface';
import {
  LEGACY_VACANCY_STORAGE_KEY,
  VACANCIES_BY_USER_STORAGE_KEY,
  VACANCY_EVENTS_BY_USER_STORAGE_KEY,
  VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY
} from './vacancy-storage.constants';
import { createDefaultEvent, createFollowUpFromVacancy, normalizeVacancy } from './vacancy-normalizer';

@Injectable()
export class LocalVacancyRepository implements VacancyRepository {
  private readonly vacanciesSubject: BehaviorSubject<Vacancy[]>;
  private readonly eventsSubject: BehaviorSubject<VacancyEvent[]>;
  private readonly followUpsSubject: BehaviorSubject<VacancyFollowUp[]>;
  private currentUserId: string | null = null;

  constructor(
    private readonly storageService: StorageService,
    private readonly authService: AuthService
  ) {
    this.migrateLegacyStorage();
    this.currentUserId = this.authService.getCurrentUserId();
    this.vacanciesSubject = new BehaviorSubject<Vacancy[]>(this.readCurrentUserVacancies());
    this.eventsSubject = new BehaviorSubject<VacancyEvent[]>(this.readCurrentUserEvents());
    this.followUpsSubject = new BehaviorSubject<VacancyFollowUp[]>(this.readCurrentUserFollowUps());

    this.authService.session$.subscribe((session) => {
      this.currentUserId = session?.userId ?? null;
      this.vacanciesSubject.next(this.readCurrentUserVacancies());
      this.eventsSubject.next(this.readCurrentUserEvents());
      this.followUpsSubject.next(this.readCurrentUserFollowUps());
    });
  }

  public watchAll(): Observable<Vacancy[]> {
    return this.vacanciesSubject.asObservable();
  }

  public watchEvents(vacancyId?: string): Observable<VacancyEvent[]> {
    if (!vacancyId) {
      return this.eventsSubject.asObservable();
    }

    return this.eventsSubject.asObservable().pipe(map((events) => events.filter((event) => event.vacancyId === vacancyId)));
  }

  public watchFollowUps(vacancyId?: string): Observable<VacancyFollowUp[]> {
    if (!vacancyId) {
      return this.followUpsSubject.asObservable();
    }

    return this.followUpsSubject
      .asObservable()
      .pipe(map((followUps) => followUps.filter((followUp) => followUp.vacancyId === vacancyId)));
  }

  public getAll(): Vacancy[] {
    return this.vacanciesSubject.value;
  }

  public getById(id: string): Vacancy | undefined {
    return this.vacanciesSubject.value.find((vacancy) => vacancy.id === id);
  }

  public getEvents(vacancyId?: string): VacancyEvent[] {
    if (!vacancyId) {
      return this.eventsSubject.value;
    }

    return this.eventsSubject.value.filter((event) => event.vacancyId === vacancyId);
  }

  public getFollowUps(vacancyId?: string): VacancyFollowUp[] {
    if (!vacancyId) {
      return this.followUpsSubject.value;
    }

    return this.followUpsSubject.value.filter((followUp) => followUp.vacancyId === vacancyId);
  }

  public create(vacancy: Vacancy): void {
    if (!this.currentUserId) {
      return;
    }

    const normalizedVacancy = normalizeVacancy({
      ...vacancy,
      updatedAt: vacancy.updatedAt ?? new Date().toISOString()
    });
    const updatedVacancies = [normalizedVacancy, ...this.vacanciesSubject.value];
    const createdEvent = createDefaultEvent(normalizedVacancy, this.currentUserId);
    const followUp = createFollowUpFromVacancy(normalizedVacancy);
    const updatedEvents = [createdEvent, ...this.eventsSubject.value];
    const updatedFollowUps = followUp ? [followUp, ...this.followUpsSubject.value] : this.followUpsSubject.value;

    this.commitEvents(updatedEvents);
    this.commitFollowUps(updatedFollowUps);
    this.commit(updatedVacancies);
  }

  public createFollowUp(followUp: VacancyFollowUp): void {
    if (!this.currentUserId) {
      return;
    }

    const now = new Date().toISOString();
    const normalizedFollowUp: VacancyFollowUp = {
      ...followUp,
      id: followUp.id || `fol_${crypto.randomUUID()}`,
      updatedAt: now,
      createdAt: followUp.createdAt || now
    };

    this.commitFollowUps([normalizedFollowUp, ...this.followUpsSubject.value]);
    this.syncVacancyFollowUpState(normalizedFollowUp.vacancyId);
  }

  public updateFollowUp(id: string, changes: Partial<VacancyFollowUp>): void {
    if (!this.currentUserId) {
      return;
    }

    let targetVacancyId: string | null = null;
    const updatedFollowUps = this.followUpsSubject.value.map((followUp) => {
      if (followUp.id !== id) {
        return followUp;
      }

      targetVacancyId = followUp.vacancyId;
      return {
        ...followUp,
        ...changes,
        id: followUp.id,
        updatedAt: new Date().toISOString()
      };
    });

    this.commitFollowUps(updatedFollowUps);
    if (targetVacancyId) {
      this.syncVacancyFollowUpState(targetVacancyId);
    }
  }

  public removeFollowUp(id: string): void {
    if (!this.currentUserId) {
      return;
    }

    const target = this.followUpsSubject.value.find((followUp) => followUp.id === id);
    const updatedFollowUps = this.followUpsSubject.value.filter((followUp) => followUp.id !== id);
    this.commitFollowUps(updatedFollowUps);

    if (target) {
      this.syncVacancyFollowUpState(target.vacancyId);
    }
  }

  public update(id: string, changes: Partial<Vacancy>, options?: { recordSystemEvent?: boolean }): void {
    if (!this.currentUserId) {
      return;
    }

    const recordSystemEvent = options?.recordSystemEvent ?? true;
    let updatedEvent: VacancyEvent | null = null;
    const updatedVacancies = this.vacanciesSubject.value.map((vacancy) => {
      if (vacancy.id !== id) {
        return vacancy;
      }

      const mergedVacancy = normalizeVacancy({
        ...vacancy,
        ...changes,
        id
      });

      if (recordSystemEvent) {
        updatedEvent = {
          id: `evt_${crypto.randomUUID()}`,
          vacancyId: id,
          type: changes.applicationStatus && changes.applicationStatus !== vacancy.applicationStatus ? 'status_changed' : 'updated',
          title: changes.applicationStatus && changes.applicationStatus !== vacancy.applicationStatus ? 'Status changed' : 'Vacancy updated',
          description:
            changes.applicationStatus && changes.applicationStatus !== vacancy.applicationStatus
              ? `Status changed from ${vacancy.applicationStatus} to ${mergedVacancy.applicationStatus}.`
              : 'Vacancy fields updated.',
          previousStatus: vacancy.applicationStatus,
          newStatus: mergedVacancy.applicationStatus,
          eventAt: mergedVacancy.updatedAt,
          createdAt: new Date().toISOString(),
          actorType: this.currentUserId ? 'user' : 'system',
          actorId: this.currentUserId,
          metadata: {
            companyResponse: mergedVacancy.companyResponse
          }
        };
      }

      return mergedVacancy;
    });

    if (updatedEvent) {
      this.commitEvents([updatedEvent, ...this.eventsSubject.value]);
    }

    this.syncFollowUpFromVacancies(updatedVacancies, id);
    this.commit(updatedVacancies);
  }

  public createEvent(event: VacancyEvent): void {
    if (!this.currentUserId) {
      return;
    }

    const now = new Date().toISOString();
    const normalizedEvent: VacancyEvent = {
      ...event,
      id: event.id || `evt_${crypto.randomUUID()}`,
      createdAt: event.createdAt || now
    };

    this.commitEvents([normalizedEvent, ...this.eventsSubject.value]);
  }

  public updateEvent(id: string, changes: Partial<VacancyEvent>): void {
    if (!this.currentUserId) {
      return;
    }

    const updatedEvents = this.eventsSubject.value.map((event) => {
      if (event.id !== id) {
        return event;
      }

      return {
        ...event,
        ...changes,
        id: event.id
      };
    });

    this.commitEvents(updatedEvents);
  }

  public removeEvent(id: string): void {
    if (!this.currentUserId) {
      return;
    }

    const updatedEvents = this.eventsSubject.value.filter((event) => event.id !== id);
    this.commitEvents(updatedEvents);
  }

  public remove(id: string): void {
    if (!this.currentUserId) {
      return;
    }

    const updatedVacancies = this.vacanciesSubject.value.filter((vacancy) => vacancy.id !== id);
    const updatedEvents = this.eventsSubject.value.filter((event) => event.vacancyId !== id);
    const updatedFollowUps = this.followUpsSubject.value.filter((followUp) => followUp.vacancyId !== id);
    this.commitEvents(updatedEvents);
    this.commitFollowUps(updatedFollowUps);
    this.commit(updatedVacancies);
  }

  public replaceAll(vacancies: Vacancy[]): void {
    if (!this.currentUserId) {
      return;
    }

    const normalizedVacancies = vacancies.map((vacancy) => normalizeVacancy(vacancy as Partial<Vacancy> & Record<string, unknown>));
    const generatedEvents = normalizedVacancies.map((vacancy) => createDefaultEvent(vacancy, this.currentUserId));
    const generatedFollowUps = normalizedVacancies
      .map((vacancy) => createFollowUpFromVacancy(vacancy))
      .filter((followUp): followUp is VacancyFollowUp => Boolean(followUp));

    this.commitEvents(generatedEvents);
    this.commitFollowUps(generatedFollowUps);
    this.commit(normalizedVacancies);
  }

  public count(): number {
    return this.vacanciesSubject.value.length;
  }

  private commit(vacancies: Vacancy[]): void {
    if (!this.currentUserId) {
      return;
    }

    const vacanciesByUser = this.readVacanciesByUserRaw();
    vacanciesByUser[this.currentUserId] = vacancies;
    this.storageService.setItem(VACANCIES_BY_USER_STORAGE_KEY, vacanciesByUser);
    this.vacanciesSubject.next(vacancies);
  }

  private commitEvents(events: VacancyEvent[]): void {
    if (!this.currentUserId) {
      return;
    }

    const eventsByUser = this.readEventsByUserRaw();
    eventsByUser[this.currentUserId] = events;
    this.storageService.setItem(VACANCY_EVENTS_BY_USER_STORAGE_KEY, eventsByUser);
    this.eventsSubject.next(events);
  }

  private commitFollowUps(followUps: VacancyFollowUp[]): void {
    if (!this.currentUserId) {
      return;
    }

    const followUpsByUser = this.readFollowUpsByUserRaw();
    followUpsByUser[this.currentUserId] = followUps;
    this.storageService.setItem(VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY, followUpsByUser);
    this.followUpsSubject.next(followUps);
  }

  private readCurrentUserVacancies(): Vacancy[] {
    if (!this.currentUserId) {
      return [];
    }

    const vacanciesByUser = this.readVacanciesByUserRaw();
    return (vacanciesByUser[this.currentUserId] ?? []).map((vacancy) =>
      normalizeVacancy(vacancy as Partial<Vacancy> & Record<string, unknown>)
    );
  }

  private readCurrentUserEvents(): VacancyEvent[] {
    if (!this.currentUserId) {
      return [];
    }

    const eventsByUser = this.readEventsByUserRaw();
    return eventsByUser[this.currentUserId] ?? [];
  }

  private readCurrentUserFollowUps(): VacancyFollowUp[] {
    if (!this.currentUserId) {
      return [];
    }

    const followUpsByUser = this.readFollowUpsByUserRaw();
    return followUpsByUser[this.currentUserId] ?? [];
  }

  private readVacanciesByUserRaw(): Record<string, Vacancy[]> {
    return this.storageService.getItem<Record<string, Vacancy[]>>(VACANCIES_BY_USER_STORAGE_KEY) ?? {};
  }

  private readEventsByUserRaw(): Record<string, VacancyEvent[]> {
    return this.storageService.getItem<Record<string, VacancyEvent[]>>(VACANCY_EVENTS_BY_USER_STORAGE_KEY) ?? {};
  }

  private readFollowUpsByUserRaw(): Record<string, VacancyFollowUp[]> {
    return this.storageService.getItem<Record<string, VacancyFollowUp[]>>(VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY) ?? {};
  }

  private migrateLegacyStorage(): void {
    const legacyVacancies = this.storageService.getItem<Vacancy[]>(LEGACY_VACANCY_STORAGE_KEY) ?? [];
    if (legacyVacancies.length === 0) {
      return;
    }

    const demoUserId = environment.auth.demoUser.username.trim().toLowerCase();
    const vacanciesByUser = this.readVacanciesByUserRaw();
    const eventsByUser = this.readEventsByUserRaw();
    const followUpsByUser = this.readFollowUpsByUserRaw();

    if (!vacanciesByUser[demoUserId] || vacanciesByUser[demoUserId].length === 0) {
      const normalized = legacyVacancies.map((vacancy) => normalizeVacancy(vacancy as Partial<Vacancy> & Record<string, unknown>));
      vacanciesByUser[demoUserId] = normalized;
      eventsByUser[demoUserId] = normalized.map((vacancy) => createDefaultEvent(vacancy, demoUserId));
      followUpsByUser[demoUserId] = normalized
        .map((vacancy) => createFollowUpFromVacancy(vacancy))
        .filter((followUp): followUp is VacancyFollowUp => Boolean(followUp));
      this.storageService.setItem(VACANCIES_BY_USER_STORAGE_KEY, vacanciesByUser);
      this.storageService.setItem(VACANCY_EVENTS_BY_USER_STORAGE_KEY, eventsByUser);
      this.storageService.setItem(VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY, followUpsByUser);
    }

    this.storageService.removeItem(LEGACY_VACANCY_STORAGE_KEY);
  }

  private syncFollowUpFromVacancies(vacancies: Vacancy[], vacancyId: string): void {
    const unrelatedFollowUps = this.followUpsSubject.value.filter((item) => item.vacancyId !== vacancyId);
    const existingFollowUps = this.followUpsSubject.value.filter((item) => item.vacancyId === vacancyId);
    const targetVacancy = vacancies.find((vacancy) => vacancy.id === vacancyId);

    if (!targetVacancy) {
      this.commitFollowUps(unrelatedFollowUps);
      return;
    }

    const followUp = createFollowUpFromVacancy(targetVacancy);

    if (!followUp) {
      this.commitFollowUps([...existingFollowUps, ...unrelatedFollowUps]);
      return;
    }

    const duplicatePending = existingFollowUps.some(
      (item) => item.status === 'pending' && item.plannedDate === followUp.plannedDate
    );
    const updatedForVacancy = duplicatePending ? existingFollowUps : [followUp, ...existingFollowUps];
    this.commitFollowUps([...updatedForVacancy, ...unrelatedFollowUps]);
  }

  private syncVacancyFollowUpState(vacancyId: string): void {
    const vacancy = this.vacanciesSubject.value.find((item) => item.id === vacancyId);
    if (!vacancy) {
      return;
    }

    const relatedFollowUps = this.followUpsSubject.value
      .filter((followUp) => followUp.vacancyId === vacancyId)
      .sort((left, right) => new Date(left.plannedDate).getTime() - new Date(right.plannedDate).getTime());

    const pendingFollowUp = relatedFollowUps.find((followUp) => followUp.status === 'pending');
    const now = new Date().toISOString();

    const updatedVacancies = this.vacanciesSubject.value.map((item) => {
      if (item.id !== vacancyId) {
        return item;
      }

      return {
        ...item,
        followUpPending: Boolean(pendingFollowUp),
        nextFollowUpDate: pendingFollowUp?.plannedDate ?? null,
        updatedAt: now
      };
    });

    this.commit(updatedVacancies);
  }
}
