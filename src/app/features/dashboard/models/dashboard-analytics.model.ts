export interface KpiMetric {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  trendLabel: string;
  trendValue: number;
  trendDirection: 'up' | 'down' | 'neutral';
}

export interface MonthlyApplicationsPoint {
  month: string;
  year?: number;
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

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  type: 'status_update' | 'interview' | 'follow_up' | 'response';
  occurredAt: string;
}

export interface DashboardAnalytics {
  metrics: KpiMetric[];
  monthlyApplications: MonthlyApplicationsPoint[];
  statusDistribution: DistributionPoint[];
  modalityDistribution: DistributionPoint[];
  stackBreakdown: StackPoint[];
  recentActivity: ActivityItem[];
}
