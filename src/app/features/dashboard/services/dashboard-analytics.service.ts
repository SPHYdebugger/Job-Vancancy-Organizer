import { Injectable } from '@angular/core';

import { DashboardPreAggregates, createEmptyDashboardPreAggregates } from '../../../core/models/dashboard-pre-aggregates.model';
import { DashboardAnalytics } from '../models/dashboard-analytics.model';
import { DashboardVacancyDto } from '../../vacancies/models/vacancy-list-item.dto';

type DashboardPriority = 'Low' | 'Medium' | 'High';
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
  public buildAnalytics(vacancies: DashboardVacancyDto[], preAggregates?: DashboardPreAggregates): DashboardAnalytics {
    const aggregate = preAggregates ?? createEmptyDashboardPreAggregates();
    const sortedByLastUpdate = [...vacancies].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
    const now = new Date();

    const metrics = [
      this.metric(
        'total-vacancies',
        aggregate.totalVacancies,
        aggregate.thisMonthCreated,
        aggregate.thisMonthCreated > 0 ? 'up' : 'neutral'
      ),
      this.metric(
        'cv-sent',
        aggregate.cvSentCount,
        aggregate.cvSentThisMonth - aggregate.cvSentPreviousMonth,
        aggregate.cvSentThisMonth - aggregate.cvSentPreviousMonth > 0
          ? 'up'
          : aggregate.cvSentThisMonth - aggregate.cvSentPreviousMonth < 0
            ? 'down'
            : 'neutral'
      ),
      this.metric('applied', aggregate.appliedCount, aggregate.appliedCount, aggregate.appliedCount > 0 ? 'up' : 'neutral'),
      this.metric(
        'interviews',
        aggregate.interviewsCount,
        aggregate.interviewsCount,
        aggregate.interviewsCount > 0 ? 'up' : 'neutral'
      ),
      this.metric(
        'technical-tests',
        aggregate.technicalTestsCount,
        aggregate.technicalTestsCount,
        'neutral'
      ),
      this.metric(
        'rejected',
        aggregate.rejectedCount,
        aggregate.rejectedThisMonth,
        aggregate.rejectedThisMonth > 0 ? 'down' : 'neutral'
      ),
      this.metric(
        'no-response',
        aggregate.noResponseCount,
        aggregate.noResponseCount,
        aggregate.noResponseCount > 0 ? 'down' : 'neutral'
      ),
      this.metric('followups', aggregate.pendingFollowUpsCount, aggregate.dueThisWeek, 'neutral')
    ];

    const monthlyApplications = this.buildMonthlyApplications(aggregate);
    const statusDistribution = this.buildStatusDistribution(aggregate);
    const modalityDistribution = this.buildModalityDistribution(aggregate);
    const stackBreakdown = this.buildStackBreakdown(aggregate);

    const recentActivity = sortedByLastUpdate.slice(0, 4).map((vacancy) => ({
      id: vacancy.id,
      title: vacancy.company,
      detail: `${vacancy.position} · ${this.toDashboardStatus(vacancy.applicationStatus)}`,
      type: this.activityType(vacancy.applicationStatus),
      occurredAt: vacancy.updatedAt
    }));

    const nextActions = sortedByLastUpdate
      .filter((vacancy) => vacancy.followUpPending || vacancy.nextFollowUpDate)
      .slice(0, 4)
      .map((vacancy) => ({
        id: `next-${vacancy.id}`,
        title: 'Follow up with recruiter',
        company: vacancy.company,
        dueDate: vacancy.nextFollowUpDate ?? this.addDays(vacancy.updatedAt, 7),
        priority: this.toDashboardPriority(vacancy.priority)
      }));

    const recentVacancies = sortedByLastUpdate.slice(0, 8).map((vacancy) => ({
      id: vacancy.id,
      company: vacancy.company,
      role: vacancy.position,
      status: this.toDashboardStatus(vacancy.applicationStatus),
      priority: this.toDashboardPriority(vacancy.priority),
      updatedAt: vacancy.updatedAt
    }));

    const topCompanies = this.buildTopCompanies(sortedByLastUpdate);

    return {
      metrics,
      monthlyApplications,
      statusDistribution,
      modalityDistribution,
      stackBreakdown,
      recentActivity,
      nextActions,
      recentVacancies,
      topCompanies,
      progress: {
        applicationsGoal: 60,
        applicationsDone: metrics.find((metric) => metric.id === 'total-vacancies')?.value ?? 0,
        interviewsGoal: 15,
        interviewsDone: metrics.find((metric) => metric.id === 'interviews')?.value ?? 0,
        followUpsGoal: 24,
        followUpsDone: metrics.find((metric) => metric.id === 'followups')?.value ?? 0
      }
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

  private buildTopCompanies(sortedVacancies: DashboardVacancyDto[]): DashboardAnalytics['topCompanies'] {
    const companies = new Map<
      string,
      { touches: number; lastContactAt: string; currentStatus: DashboardStatus }
    >();

    sortedVacancies.forEach((vacancy) => {
      const company = companies.get(vacancy.company);
      const status = this.toDashboardStatus(vacancy.applicationStatus);

      if (!company) {
        companies.set(vacancy.company, {
          touches: 1,
          currentStatus: status,
          lastContactAt: vacancy.updatedAt
        });
        return;
      }

      company.touches += 1;

      if (new Date(vacancy.updatedAt).getTime() > new Date(company.lastContactAt).getTime()) {
        company.lastContactAt = vacancy.updatedAt;
        company.currentStatus = status;
      }
    });

    return [...companies.entries()]
      .map(([company, summary]) => ({
        company,
        touches: summary.touches,
        currentStatus: summary.currentStatus,
        lastContactAt: summary.lastContactAt
      }))
      .sort((left, right) => right.touches - left.touches)
      .slice(0, 5);
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

    return map[status];
  }

  private toDashboardPriority(priority: DashboardVacancyDto['priority']): DashboardPriority {
    const map: Record<DashboardVacancyDto['priority'], DashboardPriority> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High'
    };

    return map[priority];
  }

  private addDays(baseDate: string, days: number): string {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }

  private activityType(
    status: DashboardVacancyDto['applicationStatus']
  ): 'status_update' | 'interview' | 'follow_up' | 'response' {
    if (status === 'interview' || status === 'technical_test') {
      return 'interview';
    }

    if (status === 'no_response') {
      return 'follow_up';
    }

    if (status === 'rejected' || status === 'hired' || status === 'finalist') {
      return 'response';
    }

    return 'status_update';
  }
}
