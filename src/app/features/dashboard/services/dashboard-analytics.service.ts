import { Injectable } from '@angular/core';

import { DashboardPreAggregates, createEmptyDashboardPreAggregates } from '../../../core/models/dashboard-pre-aggregates.model';
import { DashboardAnalytics } from '../models/dashboard-analytics.model';
import { DashboardVacancyDto } from '../../vacancies/models/vacancy-list-item.dto';
import { VacancyEvent, VacancyEventType } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';

type DashboardStatus =
  | 'Pending'
  | 'CV Sent'
  | 'Applied'
  | 'In Review'
  | 'HR Contact'
  | 'Interview'
  | 'Technical Test'
  | 'Finalist'
  | 'Rejected'
  | 'No Response'
  | 'Hired';

@Injectable({
  providedIn: 'root'
})
export class DashboardAnalyticsService {
  public buildAnalytics(
    vacancies: DashboardVacancyDto[],
    preAggregates?: DashboardPreAggregates,
    events: VacancyEvent[] = [],
    followUps: VacancyFollowUp[] = []
  ): DashboardAnalytics {
    const aggregate = preAggregates ?? createEmptyDashboardPreAggregates();
    const now = new Date();

    const closedStatuses = new Set(['rejected', 'withdrawn', 'hired', 'archived']);
    const activeCount = vacancies.filter((vacancy) => !closedStatuses.has(vacancy.applicationStatus)).length;
    const respondedCount = vacancies.filter((vacancy) => ['positive', 'negative'].includes(vacancy.companyResponse)).length;
    const responseBase = vacancies.filter((vacancy) => !['draft', 'saved'].includes(vacancy.applicationStatus)).length;
    const responseRate = responseBase > 0 ? Math.round((respondedCount / responseBase) * 100) : 0;
    const interviewVacancyIds = new Set(
      events.filter((event) => ['interview_scheduled', 'interview_completed'].includes(event.type)).map((event) => event.vacancyId)
    );
    vacancies
      .filter((vacancy) => ['interview', 'technical_test', 'offer', 'finalist', 'hired'].includes(vacancy.applicationStatus))
      .forEach((vacancy) => interviewVacancyIds.add(vacancy.id));
    const overdueFollowUps = followUps.filter(
      (followUp) => followUp.status === 'pending' && new Date(followUp.plannedDate).getTime() < now.getTime()
    ).length;

    const metrics = [
      this.metric('active', activeCount, aggregate.thisMonthCreated, activeCount > 0 ? 'up' : 'neutral'),
      { ...this.metric('response-rate', responseRate, respondedCount, responseRate > 0 ? 'up' : 'neutral'), suffix: '%' },
      this.metric('interviews', interviewVacancyIds.size, interviewVacancyIds.size, interviewVacancyIds.size > 0 ? 'up' : 'neutral'),
      this.metric('overdue-followups', overdueFollowUps, overdueFollowUps, overdueFollowUps > 0 ? 'down' : 'neutral')
    ];

    const monthlyApplications = this.buildMonthlyApplications(aggregate);
    const statusDistribution = this.buildStatusDistribution(aggregate);
    const modalityDistribution = this.buildModalityDistribution(aggregate);
    const stackBreakdown = this.buildStackBreakdown(aggregate);

    const vacancyById = new Map(vacancies.map((vacancy) => [vacancy.id, vacancy]));
    const recentActivity = [...events]
      .sort((left, right) => new Date(right.eventAt).getTime() - new Date(left.eventAt).getTime())
      .slice(0, 5)
      .map((event) => {
        const vacancy = vacancyById.get(event.vacancyId);
        return {
          id: event.id,
          title: event.title,
          detail: vacancy ? `${vacancy.company} · ${vacancy.position}` : event.description,
          type: this.eventActivityType(event.type),
          occurredAt: event.eventAt
        };
      });

    return {
      metrics,
      monthlyApplications,
      statusDistribution,
      modalityDistribution,
      stackBreakdown,
      recentActivity
    };
  }

  private metric(
    id: string,
    value: number,
    trendValue: number,
    trendDirection: 'up' | 'down' | 'neutral'
  ): DashboardAnalytics['metrics'][number] {
    return { id, label: id, value, trendLabel: '', trendValue, trendDirection };
  }

  private buildMonthlyApplications(aggregate: DashboardPreAggregates): DashboardAnalytics['monthlyApplications'] {
    return aggregate.monthlyApplications.map((point) => ({
      month: point.month,
      year: point.year,
      total: point.total
    }));
  }

  private buildStatusDistribution(aggregate: DashboardPreAggregates): DashboardAnalytics['statusDistribution'] {
    const statusOrder: Array<DashboardVacancyDto['applicationStatus']> = [
      'pending',
      'cv_sent',
      'applied',
      'in_review',
      'hr_contact',
      'interview',
      'technical_test',
      'no_response',
      'rejected',
      'finalist',
      'hired'
    ];

    return statusOrder
      .map((status) => ({
        label: this.toDashboardStatus(status),
        value: aggregate.statusCounts[status] ?? 0
      }))
      .filter((item) => item.value > 0);
  }

  private buildModalityDistribution(aggregate: DashboardPreAggregates): DashboardAnalytics['modalityDistribution'] {
    return [
      { label: 'Remote', value: aggregate.modalityCounts.remote },
      { label: 'Hybrid', value: aggregate.modalityCounts.hybrid },
      { label: 'On-site', value: aggregate.modalityCounts.on_site }
    ].filter((item) => item.value > 0);
  }

  private buildStackBreakdown(aggregate: DashboardPreAggregates): DashboardAnalytics['stackBreakdown'] {
    return Object.entries(aggregate.stackCounts)
      .map(([stack, total]) => ({ stack, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 8);
  }

  private toDashboardStatus(status: DashboardVacancyDto['applicationStatus']): DashboardStatus {
    const map: Record<DashboardVacancyDto['applicationStatus'], DashboardStatus> = {
      draft: 'Pending',
      saved: 'Pending',
      pending: 'Pending',
      cv_sent: 'CV Sent',
      applied: 'Applied',
      in_review: 'In Review',
      hr_contact: 'HR Contact',
      interview: 'Interview',
      technical_test: 'Technical Test',
      offer: 'Finalist',
      finalist: 'Finalist',
      rejected: 'Rejected',
      withdrawn: 'Rejected',
      no_response: 'No Response',
      hired: 'Hired',
      archived: 'No Response'
    };

    return map[status] ?? 'Pending';
  }

  private eventActivityType(type: VacancyEventType): 'status_update' | 'interview' | 'follow_up' | 'response' {
    if (type === 'interview_scheduled' || type === 'interview_completed' || type.startsWith('technical_test')) {
      return 'interview';
    }

    if (type.startsWith('follow_up')) {
      return 'follow_up';
    }

    if (type === 'response_received' || type === 'rejected' || type === 'hired' || type.startsWith('offer_')) {
      return 'response';
    }

    return 'status_update';
  }
}
