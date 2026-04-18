import { Vacancy } from './vacancy.model';

export interface DashboardMonthlyAggregatePoint {
  month: string;
  year: number;
  total: number;
}

export interface DashboardPreAggregates {
  totalVacancies: number;
  thisMonthCreated: number;
  cvSentCount: number;
  cvSentThisMonth: number;
  cvSentPreviousMonth: number;
  appliedCount: number;
  interviewsCount: number;
  technicalTestsCount: number;
  rejectedCount: number;
  rejectedThisMonth: number;
  noResponseCount: number;
  pendingFollowUpsCount: number;
  dueThisWeek: number;
  monthlyApplications: DashboardMonthlyAggregatePoint[];
  statusCounts: Record<Vacancy['applicationStatus'], number>;
  modalityCounts: Record<Vacancy['modality'], number>;
  stackCounts: Record<string, number>;
}

export function createEmptyDashboardPreAggregates(): DashboardPreAggregates {
  return {
    totalVacancies: 0,
    thisMonthCreated: 0,
    cvSentCount: 0,
    cvSentThisMonth: 0,
    cvSentPreviousMonth: 0,
    appliedCount: 0,
    interviewsCount: 0,
    technicalTestsCount: 0,
    rejectedCount: 0,
    rejectedThisMonth: 0,
    noResponseCount: 0,
    pendingFollowUpsCount: 0,
    dueThisWeek: 0,
    monthlyApplications: [],
    statusCounts: {
      draft: 0,
      saved: 0,
      pending: 0,
      cv_sent: 0,
      applied: 0,
      in_review: 0,
      hr_contact: 0,
      interview: 0,
      technical_test: 0,
      offer: 0,
      finalist: 0,
      rejected: 0,
      withdrawn: 0,
      no_response: 0,
      hired: 0,
      archived: 0
    },
    modalityCounts: {
      remote: 0,
      hybrid: 0,
      on_site: 0
    },
    stackCounts: {}
  };
}

