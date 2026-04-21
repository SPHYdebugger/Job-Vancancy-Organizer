import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, skip } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import { createEmptyDashboardPreAggregates, DashboardPreAggregates } from '../../../core/models/dashboard-pre-aggregates.model';
import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import { Vacancy } from '../../../core/models/vacancy.model';
import { StorageService } from '../../../core/services/storage.service';
import { ReadModelState, VacancyRepository } from '../../../core/services/vacancy-repository.interface';
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
  private readonly readModelSubject = new BehaviorSubject<ReadModelState>({
    vacancies: [],
    events: [],
    followUps: [],
    preAggregates: createEmptyDashboardPreAggregates()
  });
  private activeVacancyById = new Map<string, Vacancy>();
  private activeEventsByVacancyId = new Map<string, VacancyEvent[]>();
  private activeFollowUpsByVacancyId = new Map<string, VacancyFollowUp[]>();
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
    this.rebuildReadModels();

    this.authService.session$.pipe(skip(1)).subscribe((session) => {
      this.currentUserId = session?.userId ?? null;
      this.vacanciesSubject.next(this.readCurrentUserVacancies());
      this.eventsSubject.next(this.readCurrentUserEvents());
      this.followUpsSubject.next(this.readCurrentUserFollowUps());
      this.rebuildReadModels();
    });
  }

  public watchReadModel(): Observable<ReadModelState> {
    return this.readModelSubject.asObservable();
  }

  public watchEvents(vacancyId?: string): Observable<VacancyEvent[]> {
    if (!vacancyId) {
      return this.readModelSubject.pipe(map((state) => state.events));
    }

    return this.readModelSubject.pipe(map(() => this.activeEventsByVacancyId.get(vacancyId) ?? []));
  }

  public watchFollowUps(vacancyId?: string): Observable<VacancyFollowUp[]> {
    if (!vacancyId) {
      return this.readModelSubject.pipe(map((state) => state.followUps));
    }

    return this.readModelSubject.pipe(map(() => this.activeFollowUpsByVacancyId.get(vacancyId) ?? []));
  }

  public getAll(): Vacancy[] {
    return this.readModelSubject.value.vacancies;
  }

  public getById(id: string): Vacancy | undefined {
    return this.activeVacancyById.get(id);
  }

  public getEvents(vacancyId?: string): VacancyEvent[] {
    if (!vacancyId) {
      return this.readModelSubject.value.events;
    }

    return this.activeEventsByVacancyId.get(vacancyId) ?? [];
  }

  public getFollowUps(vacancyId?: string): VacancyFollowUp[] {
    if (!vacancyId) {
      return this.readModelSubject.value.followUps;
    }

    return this.activeFollowUpsByVacancyId.get(vacancyId) ?? [];
  }

  public getDashboardPreAggregates(): DashboardPreAggregates {
    return this.readModelSubject.value.preAggregates;
  }

  public create(vacancy: Vacancy): void {
    if (!this.currentUserId) {
      return;
    }

    const normalizedVacancy = normalizeVacancy({
      ...vacancy,
      deletedAt: vacancy.deletedAt ?? null,
      updatedAt: vacancy.updatedAt ?? new Date().toISOString()
    });
    const updatedVacancies = [normalizedVacancy, ...this.vacanciesSubject.value];
    const createdEvent = createDefaultEvent(normalizedVacancy, this.currentUserId);
    const followUp = createFollowUpFromVacancy(normalizedVacancy);
    const updatedEvents = [createdEvent, ...this.eventsSubject.value];
    const updatedFollowUps = followUp ? [followUp, ...this.followUpsSubject.value] : this.followUpsSubject.value;

    this.commitEvents(updatedEvents, true);
    this.commitFollowUps(updatedFollowUps, true);
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
      deletedAt: followUp.deletedAt ?? null,
      updatedAt: now,
      createdAt: followUp.createdAt || now
    };

    this.commitFollowUps([normalizedFollowUp, ...this.followUpsSubject.value], true);
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

    this.commitFollowUps(updatedFollowUps, true);
    if (targetVacancyId) {
      this.syncVacancyFollowUpState(targetVacancyId);
    }
  }

  public removeFollowUp(id: string): void {
    if (!this.currentUserId) {
      return;
    }

    const target = this.followUpsSubject.value.find((followUp) => followUp.id === id);
    const deletedAt = new Date().toISOString();
    const updatedFollowUps = this.followUpsSubject.value.map((followUp) => {
      if (followUp.id !== id || followUp.deletedAt) {
        return followUp;
      }

      return {
        ...followUp,
        deletedAt,
        updatedAt: deletedAt
      };
    });
    this.commitFollowUps(updatedFollowUps, true);

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
          deletedAt: null,
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
      this.commitEvents([updatedEvent, ...this.eventsSubject.value], true);
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
      deletedAt: event.deletedAt ?? null,
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

    const deletedAt = new Date().toISOString();
    const updatedEvents = this.eventsSubject.value.map((event) => {
      if (event.id !== id || event.deletedAt) {
        return event;
      }

      return {
        ...event,
        deletedAt
      };
    });
    this.commitEvents(updatedEvents);
  }

  public remove(id: string): void {
    if (!this.currentUserId) {
      return;
    }

    const now = new Date().toISOString();
    const updatedVacancies = this.vacanciesSubject.value.map((vacancy) => {
      if (vacancy.id !== id || vacancy.deletedAt) {
        return vacancy;
      }

      return {
        ...vacancy,
        deletedAt: now,
        updatedAt: now
      };
    });

    this.commit(updatedVacancies);
  }

  public softDeleteAllForCurrentUser(): void {
    if (!this.currentUserId) {
      return;
    }

    this.commitEvents([], true);
    this.commitFollowUps([], true);
    this.commit([]);
  }

  public importSnapshot(snapshot: {
    vacancies: Vacancy[];
    events: VacancyEvent[];
    followUps: VacancyFollowUp[];
  }): void {
    if (!this.currentUserId) {
      return;
    }

    const normalizedVacancies = snapshot.vacancies.map((vacancy) =>
      normalizeVacancy(vacancy as Partial<Vacancy> & Record<string, unknown>)
    );
    const existingVacancyIds = new Set(this.vacanciesSubject.value.map((vacancy) => vacancy.id));
    const newVacancies = normalizedVacancies.filter((vacancy) => !existingVacancyIds.has(vacancy.id));
    const vacancyIds = new Set(normalizedVacancies.map((vacancy) => vacancy.id));
    const normalizedEvents = snapshot.events
      .filter((event) => vacancyIds.has(event.vacancyId))
      .map((event) => ({
        ...event,
        deletedAt: event.deletedAt ?? (event as VacancyEvent & { deleted_at?: string | null }).deleted_at ?? null,
        createdAt: event.createdAt || event.eventAt || new Date().toISOString(),
        eventAt: event.eventAt || event.createdAt || new Date().toISOString()
      }));
    const normalizedFollowUps = snapshot.followUps.filter((followUp) => vacancyIds.has(followUp.vacancyId));
    const followUpsWithDeleteState = normalizedFollowUps.map((followUp) => ({
      ...followUp,
      deletedAt: followUp.deletedAt ?? (followUp as VacancyFollowUp & { deleted_at?: string | null }).deleted_at ?? null
    }));
    const existingEventIds = new Set(this.eventsSubject.value.map((event) => event.id));
    const existingFollowUpIds = new Set(this.followUpsSubject.value.map((followUp) => followUp.id));
    const newEvents = normalizedEvents.filter((event) => !existingEventIds.has(event.id));
    const newFollowUps = followUpsWithDeleteState.filter((followUp) => !existingFollowUpIds.has(followUp.id));

    const mergedVacancies = [...newVacancies, ...this.vacanciesSubject.value];
    const mergedEvents = [...newEvents, ...this.eventsSubject.value];
    const mergedFollowUps = [...newFollowUps, ...this.followUpsSubject.value];

    this.commitEvents(mergedEvents, true);
    this.commitFollowUps(mergedFollowUps, true);
    this.commit(mergedVacancies);
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

    this.commitEvents(generatedEvents, true);
    this.commitFollowUps(generatedFollowUps, true);
    this.commit(normalizedVacancies);
  }

  public count(): number {
    return this.readModelSubject.value.vacancies.length;
  }

  private commit(vacancies: Vacancy[], skipRebuild = false): void {
    if (!this.currentUserId) {
      return;
    }

    const vacanciesByUser = this.readVacanciesByUserRaw();
    vacanciesByUser[this.currentUserId] = vacancies;
    this.storageService.setItem(VACANCIES_BY_USER_STORAGE_KEY, vacanciesByUser);
    this.vacanciesSubject.next(vacancies);
    if (!skipRebuild) this.rebuildReadModels();
  }

  private commitEvents(events: VacancyEvent[], skipRebuild = false): void {
    if (!this.currentUserId) {
      return;
    }

    const eventsByUser = this.readEventsByUserRaw();
    eventsByUser[this.currentUserId] = events;
    this.storageService.setItem(VACANCY_EVENTS_BY_USER_STORAGE_KEY, eventsByUser);
    this.eventsSubject.next(events);
    if (!skipRebuild) this.rebuildReadModels();
  }

  private commitFollowUps(followUps: VacancyFollowUp[], skipRebuild = false): void {
    if (!this.currentUserId) {
      return;
    }

    const followUpsByUser = this.readFollowUpsByUserRaw();
    followUpsByUser[this.currentUserId] = followUps;
    this.storageService.setItem(VACANCY_FOLLOWUPS_BY_USER_STORAGE_KEY, followUpsByUser);
    this.followUpsSubject.next(followUps);
    if (!skipRebuild) this.rebuildReadModels();
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
    return (eventsByUser[this.currentUserId] ?? []).map((event) => ({
      ...event,
      deletedAt: event.deletedAt ?? (event as VacancyEvent & { deleted_at?: string | null }).deleted_at ?? null
    }));
  }

  private readCurrentUserFollowUps(): VacancyFollowUp[] {
    if (!this.currentUserId) {
      return [];
    }

    const followUpsByUser = this.readFollowUpsByUserRaw();
    return (followUpsByUser[this.currentUserId] ?? []).map((followUp) => ({
      ...followUp,
      deletedAt: followUp.deletedAt ?? (followUp as VacancyFollowUp & { deleted_at?: string | null }).deleted_at ?? null
    }));
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
    const existingFollowUps = this.followUpsSubject.value.filter((item) => item.vacancyId === vacancyId && item.deletedAt == null);
    const targetVacancy = vacancies.find((vacancy) => vacancy.id === vacancyId);

    if (!targetVacancy || targetVacancy.deletedAt) {
      this.commitFollowUps(unrelatedFollowUps, true);
      return;
    }

    const followUp = createFollowUpFromVacancy(targetVacancy);

    if (!followUp) {
      this.commitFollowUps([...existingFollowUps, ...unrelatedFollowUps], true);
      return;
    }

    const duplicatePending = existingFollowUps.some(
      (item) => item.status === 'pending' && item.plannedDate === followUp.plannedDate
    );
    const updatedForVacancy = duplicatePending ? existingFollowUps : [followUp, ...existingFollowUps];
    this.commitFollowUps([...updatedForVacancy, ...unrelatedFollowUps], true);
  }

  private syncVacancyFollowUpState(vacancyId: string): void {
    const vacancy = this.vacanciesSubject.value.find((item) => item.id === vacancyId);
    if (!vacancy || vacancy.deletedAt) {
      return;
    }

    const relatedFollowUps = this.followUpsSubject.value
      .filter((followUp) => followUp.vacancyId === vacancyId && followUp.deletedAt == null)
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

  private getActiveVacancies(vacancies: Vacancy[]): Vacancy[] {
    return vacancies.filter((vacancy) => vacancy.deletedAt == null);
  }

  private getActiveEvents(events: VacancyEvent[]): VacancyEvent[] {
    return events.filter((event) => event.deletedAt == null);
  }

  private getFollowUpsForActiveVacancies(followUps: VacancyFollowUp[], vacancies: Vacancy[]): VacancyFollowUp[] {
    const activeVacancyIds = new Set(this.getActiveVacancies(vacancies).map((vacancy) => vacancy.id));
    return followUps.filter((followUp) => followUp.deletedAt == null && activeVacancyIds.has(followUp.vacancyId));
  }

  private rebuildReadModels(): void {
    const activeVacancies = this.getActiveVacancies(this.vacanciesSubject.value);
    const activeEvents = this.getActiveEvents(this.eventsSubject.value);
    const activeFollowUps = this.getFollowUpsForActiveVacancies(this.followUpsSubject.value, activeVacancies);

    this.activeVacancyById = new Map(activeVacancies.map((vacancy) => [vacancy.id, vacancy]));
    this.activeEventsByVacancyId = this.groupByVacancyId(activeEvents);
    this.activeFollowUpsByVacancyId = this.groupByVacancyId(activeFollowUps);

    this.readModelSubject.next({
      vacancies: activeVacancies,
      events: activeEvents,
      followUps: activeFollowUps,
      preAggregates: this.buildDashboardPreAggregates(activeVacancies)
    });
  }

  private groupByVacancyId<T extends { vacancyId: string }>(items: T[]): Map<string, T[]> {
    const grouped = new Map<string, T[]>();
    for (const item of items) {
      const current = grouped.get(item.vacancyId);
      if (current) {
        current.push(item);
        continue;
      }

      grouped.set(item.vacancyId, [item]);
    }

    return grouped;
  }

  private buildDashboardPreAggregates(vacancies: Vacancy[]): DashboardPreAggregates {
    const base = createEmptyDashboardPreAggregates();
    const now = new Date();
    const currentWeekStart = this.startOfWeek(now);
    const nextWeekStart = this.addDays(currentWeekStart, 7);
    const previousWeekStart = this.addDays(currentWeekStart, -7);
    const weeklyBuckets = this.initializeWeeklyBuckets(now);
    const appliedStatuses = new Set<Vacancy['applicationStatus']>([
      'applied',
      'in_review',
      'hr_contact',
      'interview',
      'technical_test',
      'finalist',
      'hired'
    ]);

    for (const vacancy of vacancies) {
      base.totalVacancies += 1;
      base.statusCounts[vacancy.applicationStatus] += 1;
      base.modalityCounts[vacancy.modality] += 1;

      if (this.isCvSentStatus(vacancy.applicationStatus)) {
        base.cvSentCount += 1;
      }

      if (appliedStatuses.has(vacancy.applicationStatus)) {
        base.appliedCount += 1;
      }

      if (vacancy.applicationStatus === 'interview') {
        base.interviewsCount += 1;
      }

      if (vacancy.applicationStatus === 'technical_test') {
        base.technicalTestsCount += 1;
      }

      if (vacancy.applicationStatus === 'rejected') {
        base.rejectedCount += 1;
      }

      if (vacancy.applicationStatus === 'no_response') {
        base.noResponseCount += 1;
      }

      if (vacancy.followUpPending) {
        base.pendingFollowUpsCount += 1;
      }

      if (this.isInRange(vacancy.createdAt || vacancy.discoveredAt, currentWeekStart, nextWeekStart)) {
        base.thisMonthCreated += 1;
      }

      if (
        this.isCvSentStatus(vacancy.applicationStatus) &&
        this.isInRange(vacancy.applicationDate || vacancy.updatedAt, currentWeekStart, nextWeekStart)
      ) {
        base.cvSentThisMonth += 1;
      }

      if (
        this.isCvSentStatus(vacancy.applicationStatus) &&
        this.isInRange(vacancy.applicationDate || vacancy.updatedAt, previousWeekStart, currentWeekStart)
      ) {
        base.cvSentPreviousMonth += 1;
      }

      if (
        vacancy.applicationStatus === 'rejected' &&
        this.isInRange(vacancy.lastStatusChangeAt || vacancy.updatedAt, currentWeekStart, nextWeekStart)
      ) {
        base.rejectedThisMonth += 1;
      }

      if (vacancy.followUpPending && vacancy.nextFollowUpDate) {
        const followUpDate = new Date(vacancy.nextFollowUpDate);
        if (!Number.isNaN(followUpDate.getTime())) {
          const daysDiff = (followUpDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          if (daysDiff >= 0 && daysDiff <= 7) {
            base.dueThisWeek += 1;
          }
        }
      }

      for (const stack of vacancy.techStack) {
        const normalized = stack.trim();
        if (!normalized) {
          continue;
        }

        base.stackCounts[normalized] = (base.stackCounts[normalized] ?? 0) + 1;
      }

      const sourceDate = vacancy.applicationDate ?? vacancy.createdAt;
      const parsedDate = new Date(sourceDate);
      if (!Number.isNaN(parsedDate.getTime())) {
        const bucketDate = this.startOfWeek(parsedDate);
        const key = this.toIsoDate(bucketDate);
        const targetBucket = weeklyBuckets.get(key);
        if (targetBucket) {
          targetBucket.total += 1;
        }
      }
    }

    base.monthlyApplications = [...weeklyBuckets.values()];
    return base;
  }

  private initializeWeeklyBuckets(now: Date): Map<string, DashboardPreAggregates['monthlyApplications'][number]> {
    const buckets = new Map<string, DashboardPreAggregates['monthlyApplications'][number]>();
    const currentWeekStart = this.startOfWeek(now);

    for (let index = 11; index >= 0; index -= 1) {
      const pointDate = this.addDays(currentWeekStart, -index * 7);
      const key = this.toIsoDate(pointDate);
      const weekYear = pointDate.getFullYear();
      const weekNumber = this.getWeekNumber(pointDate);
      buckets.set(key, {
        month: `W${weekNumber}`,
        year: weekYear,
        total: 0
      });
    }

    return buckets;
  }

  private isInRange(dateValue: string | null | undefined, rangeStart: Date, rangeEnd: Date): boolean {
    if (!dateValue) {
      return false;
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return false;
    }

    return parsedDate >= rangeStart && parsedDate < rangeEnd;
  }

  private startOfWeek(date: Date): Date {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);
    const day = normalizedDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    normalizedDate.setDate(normalizedDate.getDate() + diff);
    return normalizedDate;
  }

  private addDays(baseDate: Date, days: number): Date {
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + days);
    return targetDate;
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private getWeekNumber(date: Date): number {
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private isCvSentStatus(status: Vacancy['applicationStatus']): boolean {
    return !['draft', 'saved', 'pending'].includes(status);
  }
}
