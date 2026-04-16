export type VacancyStatus =
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

export type Modality = 'Remote' | 'Hybrid' | 'On-site';

export interface KpiMetric {
  id: string;
  label: string;
  value: number;
  trendLabel: string;
  trendValue: number;
  trendDirection: 'up' | 'down' | 'neutral';
}

export interface MonthlyApplicationsPoint {
  month: string;
  total: number;
}

export interface DistributionPoint {
  label: string;
  value: number;
}

export interface StackPoint {
  stack: string;
  total: number;
}

export interface RecentVacancy {
  id: string;
  company: string;
  role: string;
  status: VacancyStatus;
  priority: 'Low' | 'Medium' | 'High';
  updatedAt: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  type: 'status_update' | 'interview' | 'follow_up' | 'response';
  occurredAt: string;
}

export interface NextAction {
  id: string;
  title: string;
  company: string;
  dueDate: string;
  priority: 'Low' | 'Medium' | 'High';
}

export interface CompanyInteraction {
  company: string;
  touches: number;
  currentStatus: VacancyStatus;
  lastContactAt: string;
}

export interface ProgressSnapshot {
  applicationsGoal: number;
  applicationsDone: number;
  interviewsGoal: number;
  interviewsDone: number;
  followUpsGoal: number;
  followUpsDone: number;
}

export interface DashboardAnalytics {
  metrics: KpiMetric[];
  monthlyApplications: MonthlyApplicationsPoint[];
  statusDistribution: DistributionPoint[];
  modalityDistribution: DistributionPoint[];
  stackBreakdown: StackPoint[];
  recentActivity: ActivityItem[];
  nextActions: NextAction[];
  recentVacancies: RecentVacancy[];
  topCompanies: CompanyInteraction[];
  progress: ProgressSnapshot;
}
