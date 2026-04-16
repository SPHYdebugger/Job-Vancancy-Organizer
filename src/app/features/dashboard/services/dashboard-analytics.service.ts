import { Injectable } from '@angular/core';

import { Vacancy } from '../../../core/models/vacancy.model';
import { DashboardAnalytics } from '../models/dashboard-analytics.model';

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
  public buildAnalytics(vacancies: Vacancy[]): DashboardAnalytics {
    const sortedByLastUpdate = [...vacancies].sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const isInMonthRange = (dateValue: string | null | undefined, rangeStart: Date, rangeEnd: Date): boolean => {
      if (!dateValue) {
        return false;
      }

      const parsedDate = new Date(dateValue);
      if (Number.isNaN(parsedDate.getTime())) {
        return false;
      }

      return parsedDate >= rangeStart && parsedDate < rangeEnd;
    };

    const thisMonthCreated = vacancies.filter((vacancy) =>
      isInMonthRange(vacancy.createdAt || vacancy.discoveredAt, currentMonthStart, nextMonthStart)
    ).length;
    const cvSentThisMonth = vacancies.filter(
      (vacancy) =>
        !['draft', 'saved', 'pending'].includes(vacancy.applicationStatus) &&
        isInMonthRange(vacancy.applicationDate || vacancy.updatedAt, currentMonthStart, nextMonthStart)
    ).length;
    const cvSentPreviousMonth = vacancies.filter(
      (vacancy) =>
        !['draft', 'saved', 'pending'].includes(vacancy.applicationStatus) &&
        isInMonthRange(vacancy.applicationDate || vacancy.updatedAt, previousMonthStart, currentMonthStart)
    ).length;
    const rejectedThisMonth = vacancies.filter(
      (vacancy) =>
        vacancy.applicationStatus === 'rejected' &&
        isInMonthRange(vacancy.lastStatusChangeAt || vacancy.updatedAt, currentMonthStart, nextMonthStart)
    ).length;
    const dueThisWeek = vacancies.filter((vacancy) => {
      if (!vacancy.followUpPending || !vacancy.nextFollowUpDate) {
        return false;
      }

      const followUpDate = new Date(vacancy.nextFollowUpDate);
      if (Number.isNaN(followUpDate.getTime())) {
        return false;
      }

      const daysDiff = (followUpDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff >= 0 && daysDiff <= 7;
    }).length;

    const metrics = [
      this.metric('total-vacancies', vacancies.length, thisMonthCreated, thisMonthCreated > 0 ? 'up' : 'neutral'),
      this.metric(
        'cv-sent',
        vacancies.filter((vacancy) => !['draft', 'saved', 'pending'].includes(vacancy.applicationStatus)).length,
        cvSentThisMonth - cvSentPreviousMonth,
        cvSentThisMonth - cvSentPreviousMonth > 0
          ? 'up'
          : cvSentThisMonth - cvSentPreviousMonth < 0
            ? 'down'
            : 'neutral'
      ),
      this.metric('applied', this.countApplied(vacancies), this.countApplied(vacancies), this.countApplied(vacancies) > 0 ? 'up' : 'neutral'),
      this.metric(
        'interviews',
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'interview').length,
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'interview').length,
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'interview').length > 0 ? 'up' : 'neutral'
      ),
      this.metric(
        'technical-tests',
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'technical_test').length,
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'technical_test').length,
        'neutral'
      ),
      this.metric(
        'rejected',
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'rejected').length,
        rejectedThisMonth,
        rejectedThisMonth > 0 ? 'down' : 'neutral'
      ),
      this.metric(
        'no-response',
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'no_response').length,
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'no_response').length,
        vacancies.filter((vacancy) => vacancy.applicationStatus === 'no_response').length > 0 ? 'down' : 'neutral'
      ),
      this.metric('followups', vacancies.filter((vacancy) => vacancy.followUpPending).length, dueThisWeek, 'neutral')
    ];

    const monthlyApplications = this.buildMonthlyApplications(vacancies, now);
    const statusDistribution = this.buildStatusDistribution(vacancies);
    const modalityDistribution = this.buildModalityDistribution(vacancies);
    const stackBreakdown = this.buildStackBreakdown(vacancies);

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

  private countApplied(vacancies: Vacancy[]): number {
    return vacancies.filter((vacancy) =>
      ['applied', 'in_review', 'hr_contact', 'interview', 'technical_test', 'finalist', 'hired'].includes(
        vacancy.applicationStatus
      )
    ).length;
  }

  private buildMonthlyApplications(vacancies: Vacancy[], now: Date): DashboardAnalytics['monthlyApplications'] {
    const points: DashboardAnalytics['monthlyApplications'] = [];

    for (let index = 11; index >= 0; index -= 1) {
      const pointDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const monthKey = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(pointDate);
      const total = vacancies.filter((vacancy) => {
        const sourceDate = vacancy.applicationDate ?? vacancy.createdAt;
        const parsedDate = new Date(sourceDate);

        return (
          parsedDate.getFullYear() === pointDate.getFullYear() &&
          parsedDate.getMonth() === pointDate.getMonth()
        );
      }).length;

      points.push({ month: monthKey, total });
    }

    return points;
  }

  private buildStatusDistribution(vacancies: Vacancy[]): DashboardAnalytics['statusDistribution'] {
    const statusOrder: Array<Vacancy['applicationStatus']> = [
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
        value: vacancies.filter((vacancy) => vacancy.applicationStatus === status).length
      }))
      .filter((item) => item.value > 0);
  }

  private buildModalityDistribution(vacancies: Vacancy[]): DashboardAnalytics['modalityDistribution'] {
    return [
      { label: 'Remote', value: vacancies.filter((vacancy) => vacancy.modality === 'remote').length },
      { label: 'Hybrid', value: vacancies.filter((vacancy) => vacancy.modality === 'hybrid').length },
      { label: 'On-site', value: vacancies.filter((vacancy) => vacancy.modality === 'on_site').length }
    ].filter((item) => item.value > 0);
  }

  private buildStackBreakdown(vacancies: Vacancy[]): DashboardAnalytics['stackBreakdown'] {
    const stackCounter = new Map<string, number>();

    vacancies.forEach((vacancy) => {
      vacancy.techStack.forEach((stack) => {
        const normalizedStack = stack.trim();
        if (!normalizedStack) {
          return;
        }

        stackCounter.set(normalizedStack, (stackCounter.get(normalizedStack) ?? 0) + 1);
      });
    });

    return [...stackCounter.entries()]
      .map(([stack, total]) => ({ stack, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 8);
  }

  private buildTopCompanies(sortedVacancies: Vacancy[]): DashboardAnalytics['topCompanies'] {
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

  private toDashboardStatus(status: Vacancy['applicationStatus']): DashboardStatus {
    const map: Record<Vacancy['applicationStatus'], DashboardStatus> = {
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

  private toDashboardPriority(priority: Vacancy['priority']): DashboardPriority {
    const map: Record<Vacancy['priority'], DashboardPriority> = {
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
    status: Vacancy['applicationStatus']
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
