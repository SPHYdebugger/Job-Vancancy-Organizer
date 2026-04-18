import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import { CompanyResponseStatus, Vacancy, VacancyStatus } from '../../../core/models/vacancy.model';
import { DashboardPreAggregates } from '../../../core/models/dashboard-pre-aggregates.model';
import { VACANCY_REPOSITORY } from '../../../core/services/vacancy-repository.token';
import { DashboardVacancyDto, VacancyListItemDto } from '../models/vacancy-list-item.dto';

export interface DashboardSnapshot {
  vacancies: DashboardVacancyDto[];
  preAggregates: DashboardPreAggregates;
  followUps: VacancyFollowUp[];
}

export interface RecordVacancyEventInput {
  type: VacancyEvent['type'];
  title: string;
  description: string;
  eventAt?: string;
  statusAfter?: VacancyStatus;
  processStage?: string;
  companyResponse?: CompanyResponseStatus;
  contactName?: string;
  contactChannel?: 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other';
  interviewType?: 'hr' | 'technical' | 'final' | 'other';
  interviewDate?: string;
  interviewResult?: 'pending' | 'passed' | 'failed' | 'unknown';
  interviewEvaluatedSkills?: string;
  interviewHighlights?: string;
  interviewNotes?: string;
  followUpDate?: string;
  followUpSubject?: string;
  followUpMessage?: string;
  cvFileName?: string;
  coverLetterFileName?: string;
  recommendationFileName?: string;
  presentationText?: string;
  rejectionReason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class VacancyService {
  private readonly vacancyRepository = inject(VACANCY_REPOSITORY);
  private readonly readModel$ = this.vacancyRepository.watchReadModel().pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly appliedListItems$ = this.readModel$.pipe(
    map((state) => state.vacancies.map((vacancy) => this.toVacancyListItem(vacancy))),
    shareReplay({ bufferSize: 1, refCount: true })
  );
  private readonly dashboardSnapshot$ = this.readModel$.pipe(
    map((state) => ({
      vacancies: state.vacancies.map((vacancy) => this.toDashboardVacancy(vacancy)),
      preAggregates: state.preAggregates,
      followUps: state.followUps
    })),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public watchDashboardSnapshot(): Observable<DashboardSnapshot> {
    return this.dashboardSnapshot$;
  }

  public watchAll(): Observable<Vacancy[]> {
    return this.readModel$.pipe(map((state) => state.vacancies));
  }

  public watchAppliedListItems(): Observable<VacancyListItemDto[]> {
    return this.appliedListItems$;
  }

  public watchEvents(vacancyId?: string): Observable<VacancyEvent[]> {
    return this.vacancyRepository.watchEvents(vacancyId);
  }

  public watchFollowUps(vacancyId?: string): Observable<VacancyFollowUp[]> {
    return this.vacancyRepository.watchFollowUps(vacancyId);
  }

  public getAll(): Vacancy[] {
    return this.vacancyRepository.getAll();
  }

  public getAppliedListItems(): VacancyListItemDto[] {
    return this.vacancyRepository.getAll().map((vacancy) => this.toVacancyListItem(vacancy));
  }

  public getById(id: string): Vacancy | undefined {
    return this.vacancyRepository.getById(id);
  }

  public getEvents(vacancyId?: string): VacancyEvent[] {
    return this.vacancyRepository.getEvents(vacancyId);
  }

  public getFollowUps(vacancyId?: string): VacancyFollowUp[] {
    return this.vacancyRepository.getFollowUps(vacancyId);
  }

  public getDashboardPreAggregates(): DashboardPreAggregates {
    return this.vacancyRepository.getDashboardPreAggregates();
  }

  public create(vacancy: Vacancy): void {
    this.vacancyRepository.create(vacancy);
  }

  public createFollowUp(followUp: VacancyFollowUp): void {
    this.vacancyRepository.createFollowUp(followUp);
  }

  public updateFollowUp(id: string, changes: Partial<VacancyFollowUp>): void {
    this.vacancyRepository.updateFollowUp(id, changes);
  }

  public removeFollowUp(id: string): void {
    this.vacancyRepository.removeFollowUp(id);
  }

  public update(id: string, changes: Partial<Vacancy>, options?: { recordSystemEvent?: boolean }): void {
    this.vacancyRepository.update(id, changes, options);
  }

  public createEvent(event: VacancyEvent): void {
    this.vacancyRepository.createEvent(event);
  }

  public updateEvent(id: string, changes: Partial<VacancyEvent>): void {
    this.vacancyRepository.updateEvent(id, changes);
  }

  public removeEvent(id: string): void {
    this.vacancyRepository.removeEvent(id);
  }

  public remove(id: string): void {
    this.vacancyRepository.remove(id);
  }

  public recordProcessEvent(vacancyId: string, input: RecordVacancyEventInput): { calendarUrl: string | null } {
    const vacancy = this.vacancyRepository.getById(vacancyId);
    if (!vacancy) {
      return { calendarUrl: null };
    }

    const now = new Date().toISOString();
    const eventAt = input.eventAt ?? now;
    const resolvedStatus = this.resolveStatus(vacancy.applicationStatus, input);
    const shouldClose = resolvedStatus === 'rejected' || resolvedStatus === 'hired' || resolvedStatus === 'withdrawn';
    const metadataAttachments = [input.cvFileName, input.coverLetterFileName, input.recommendationFileName].filter(
      (item): item is string => Boolean(item)
    );
    const interviewDateIso = input.interviewDate ? new Date(input.interviewDate).toISOString() : undefined;
    const followUpDateIso = input.followUpDate ? new Date(input.followUpDate).toISOString() : undefined;
    const pendingFollowUps = this.vacancyRepository
      .getFollowUps(vacancyId)
      .filter((followUp) => followUp.status === 'pending')
      .sort((left, right) => new Date(left.plannedDate).getTime() - new Date(right.plannedDate).getTime());
    const targetPendingFollowUp = input.type === 'follow_up_sent' ? pendingFollowUps[0] : null;
    const pendingAfterSend = targetPendingFollowUp ? pendingFollowUps.slice(1) : pendingFollowUps;
    const nextPendingDateAfterSend = pendingAfterSend.length > 0 ? pendingAfterSend[0].plannedDate : null;

    this.vacancyRepository.update(
      vacancyId,
      {
        updatedAt: now,
        applicationStatus: resolvedStatus,
        lastStatusChangeAt: resolvedStatus !== vacancy.applicationStatus ? eventAt : vacancy.lastStatusChangeAt,
        applicationDate: input.type === 'applied' ? vacancy.applicationDate || eventAt : vacancy.applicationDate,
        processStage: input.processStage || vacancy.processStage,
        companyResponse: input.companyResponse ?? vacancy.companyResponse,
        lastContactAt: input.contactName || input.contactChannel ? eventAt : vacancy.lastContactAt,
        contactName: input.contactName || vacancy.contactName,
        followUpPending: followUpDateIso ? true : input.type === 'follow_up_sent' ? Boolean(nextPendingDateAfterSend) : vacancy.followUpPending,
        nextFollowUpDate:
          followUpDateIso ?? (input.type === 'follow_up_sent' ? nextPendingDateAfterSend : vacancy.nextFollowUpDate),
        rejectionReason: input.rejectionReason ?? vacancy.rejectionReason,
        closureReason: shouldClose ? (input.rejectionReason || input.type) : vacancy.closureReason,
        closedAt: shouldClose ? eventAt : null
      },
      { recordSystemEvent: false }
    );

    this.vacancyRepository.createEvent({
      id: `evt_${crypto.randomUUID()}`,
      deletedAt: null,
      vacancyId,
      type: input.type,
      title: input.title,
      description: input.description,
      previousStatus: vacancy.applicationStatus,
      newStatus: resolvedStatus,
      eventAt,
      createdAt: now,
      actorType: 'user',
      actorId: null,
      metadata: {
        contactName: input.contactName || vacancy.contactName || undefined,
        companyResponse: input.companyResponse,
        interviewType: input.interviewType,
        interviewResult: input.interviewResult,
        followUpDate: followUpDateIso,
        messageSnapshot: input.presentationText || input.followUpMessage,
        rejectionReason: input.rejectionReason,
        attachments: metadataAttachments.length > 0 ? metadataAttachments : undefined,
        customFields: {
          contactChannel: input.contactChannel,
          interviewDate: interviewDateIso,
          followUpSubject: input.followUpSubject,
          interviewEvaluatedSkills: input.interviewEvaluatedSkills,
          interviewHighlights: input.interviewHighlights,
          interviewNotes: input.interviewNotes
        }
      }
    });

    if (followUpDateIso) {
      this.vacancyRepository.createFollowUp({
        id: `fol_${crypto.randomUUID()}`,
        vacancyId,
        plannedDate: followUpDateIso,
        completedAt: null,
        status: 'pending',
        channel: input.contactChannel ?? 'email',
        subject: input.followUpSubject || `Follow-up ${vacancy.company}`,
        message: input.followUpMessage || '',
        responseReceived: false,
        responseSummary: '',
        createdAt: now,
        updatedAt: now
      });
    }

    if (targetPendingFollowUp) {
      this.vacancyRepository.updateFollowUp(targetPendingFollowUp.id, {
        status: 'completed',
        completedAt: eventAt,
        responseSummary: input.description
      });
    }

    return {
      calendarUrl: interviewDateIso
        ? this.buildGoogleCalendarUrl({
            company: vacancy.company,
            position: vacancy.position,
            interviewType: input.interviewType ?? 'other',
            interviewDateIso
          })
        : null
    };
  }

  private resolveStatus(current: VacancyStatus, input: RecordVacancyEventInput): VacancyStatus {
    if (input.statusAfter) {
      return input.statusAfter;
    }

    if (input.type === 'applied') {
      return 'applied';
    }

    if (input.type === 'response_received') {
      if (input.companyResponse === 'negative') {
        return 'rejected';
      }

      if (input.companyResponse === 'positive') {
        return 'hr_contact';
      }
    }

    if (input.type === 'interview_scheduled' || input.type === 'interview_completed') {
      return 'interview';
    }

    if (input.type === 'technical_test_sent' || input.type === 'technical_test_completed') {
      return 'technical_test';
    }

    if (input.type === 'hired') {
      return 'hired';
    }

    if (input.type === 'rejected') {
      return 'rejected';
    }

    if (input.type === 'withdrawn') {
      return 'withdrawn';
    }

    if (input.type === 'follow_up_sent') {
      return current;
    }

    return current;
  }

  private buildGoogleCalendarUrl(input: {
    company: string;
    position: string;
    interviewType: 'hr' | 'technical' | 'final' | 'other';
    interviewDateIso: string;
  }): string {
    const start = new Date(input.interviewDateIso);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const formatDate = (date: Date): string => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const title = `${input.company} - ${input.interviewType.toUpperCase()} Interview`;
    const details = `Role: ${input.position}\nCompany: ${input.company}`;
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${formatDate(start)}/${formatDate(end)}`,
      details
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  private toVacancyListItem(vacancy: Vacancy): VacancyListItemDto {
    return {
      id: vacancy.id,
      company: vacancy.company,
      position: vacancy.position,
      domain: vacancy.domain,
      headquarters: vacancy.headquarters,
      contactName: vacancy.contactName,
      notes: vacancy.notes,
      tags: vacancy.tags,
      techStack: vacancy.techStack,
      applicationStatus: vacancy.applicationStatus,
      modality: vacancy.modality,
      priority: vacancy.priority,
      applicationDate: vacancy.applicationDate,
      createdAt: vacancy.createdAt,
      updatedAt: vacancy.updatedAt
    };
  }

  private toDashboardVacancy(vacancy: Vacancy): DashboardVacancyDto {
    return {
      id: vacancy.id,
      company: vacancy.company,
      position: vacancy.position,
      techStack: vacancy.techStack,
      applicationStatus: vacancy.applicationStatus,
      modality: vacancy.modality,
      priority: vacancy.priority,
      createdAt: vacancy.createdAt,
      discoveredAt: vacancy.discoveredAt,
      applicationDate: vacancy.applicationDate,
      updatedAt: vacancy.updatedAt,
      followUpPending: vacancy.followUpPending,
      nextFollowUpDate: vacancy.nextFollowUpDate,
      lastStatusChangeAt: vacancy.lastStatusChangeAt
    };
  }
}
