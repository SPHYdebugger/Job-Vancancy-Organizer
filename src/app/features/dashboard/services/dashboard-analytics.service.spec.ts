import { createEmptyDashboardPreAggregates } from '../../../core/models/dashboard-pre-aggregates.model';
import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import { DashboardVacancyDto } from '../../vacancies/models/vacancy-list-item.dto';
import { DashboardAnalyticsService } from './dashboard-analytics.service';

describe('DashboardAnalyticsService', () => {
  const service = new DashboardAnalyticsService();

  it('builds the four actionable metrics and uses real events for activity', () => {
    const vacancy = createVacancy();
    const event = createEvent(vacancy.id);
    const overdueFollowUp = createFollowUp(vacancy.id);

    const result = service.buildAnalytics(
      [vacancy],
      createEmptyDashboardPreAggregates(),
      [event],
      [overdueFollowUp]
    );

    expect(result.metrics.map((metric) => metric.id)).toEqual([
      'active',
      'response-rate',
      'interviews',
      'overdue-followups'
    ]);
    expect(result.metrics.find((metric) => metric.id === 'response-rate')?.value).toBe(100);
    expect(result.metrics.find((metric) => metric.id === 'interviews')?.value).toBe(1);
    expect(result.metrics.find((metric) => metric.id === 'overdue-followups')?.value).toBe(1);
    expect(result.recentActivity[0]).toEqual(
      jasmine.objectContaining({ id: event.id, title: event.title, detail: 'Acme · Backend Engineer' })
    );
  });
});

function createVacancy(): DashboardVacancyDto {
  return {
    id: 'vacancy-1',
    company: 'Acme',
    position: 'Backend Engineer',
    techStack: ['TypeScript'],
    applicationStatus: 'interview',
    modality: 'remote',
    priority: 'high',
    companyResponse: 'positive',
    createdAt: '2026-09-01T09:00:00.000Z',
    discoveredAt: '2026-09-01T09:00:00.000Z',
    applicationDate: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-05T09:00:00.000Z',
    followUpPending: true,
    nextFollowUpDate: '2000-01-01T09:00:00.000Z',
    lastStatusChangeAt: '2026-09-05T09:00:00.000Z'
  };
}

function createEvent(vacancyId: string): VacancyEvent {
  return {
    id: 'event-1',
    deletedAt: null,
    vacancyId,
    type: 'interview_scheduled',
    title: 'Interview scheduled',
    description: 'Technical interview',
    previousStatus: 'applied',
    newStatus: 'interview',
    eventAt: '2026-09-05T09:00:00.000Z',
    createdAt: '2026-09-05T09:00:00.000Z',
    actorType: 'user',
    actorId: null,
    metadata: {}
  };
}

function createFollowUp(vacancyId: string): VacancyFollowUp {
  return {
    id: 'follow-up-1',
    deletedAt: null,
    vacancyId,
    plannedDate: '2000-01-01T09:00:00.000Z',
    completedAt: null,
    status: 'pending',
    channel: 'email',
    subject: 'Follow up',
    message: '',
    responseReceived: false,
    responseSummary: '',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z'
  };
}
