import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
  ApexResponsive,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule
} from 'ng-apexcharts';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../../core/i18n/translations';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { dashboardStatusToTranslationKey } from '../../../../shared/utils/label-mappers';
import { DashboardAnalyticsService } from '../../services/dashboard-analytics.service';
import { VacancyService, DashboardSnapshot } from '../../../vacancies/services/vacancy.service';
import { VacancyFollowUp } from '../../../../core/models/vacancy-followup.model';
import { DashboardPreAggregates, createEmptyDashboardPreAggregates } from '../../../../core/models/dashboard-pre-aggregates.model';
import {
  CompanyInteraction,
  DashboardAnalytics,
  DistributionPoint,
  KpiMetric,
  NextAction,
  RecentVacancy,
  StackPoint
} from '../../models/dashboard-analytics.model';
import { DashboardVacancyDto } from '../../../vacancies/models/vacancy-list-item.dto';

interface AreaChartOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  grid: ApexGrid;
  fill: ApexFill;
  tooltip: ApexTooltip;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  colors: string[];
}

interface DonutChartOptions {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  legend: ApexLegend;
  dataLabels: ApexDataLabels;
  plotOptions: ApexPlotOptions;
  stroke: ApexStroke;
  tooltip: ApexTooltip;
  colors: string[];
  responsive: ApexResponsive[];
}

interface HorizontalBarOptions {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  grid: ApexGrid;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  tooltip: ApexTooltip;
  colors: string[];
}

type ChartKey = 'applications' | 'status' | 'modality' | 'stack';
type FollowUpStatus = VacancyFollowUp['status'];

interface DashboardFollowUpItem {
  id: string;
  vacancyId: string;
  company: string;
  position: string;
  subject: string;
  plannedDate: string;
  status: FollowUpStatus;
  overdue: boolean;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    NgApexchartsModule,
    TranslatePipe,
    RouterLink
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent {
  private readonly analyticsService = inject(DashboardAnalyticsService);
  private readonly vacancyService = inject(VacancyService);
  private readonly i18nService = inject(I18nService);
  private readonly loaderMinDurationMs = 120;

  private readonly snapshot = toSignal(this.vacancyService.watchDashboardSnapshot(), {
    initialValue: {
      vacancies: [] as DashboardVacancyDto[],
      preAggregates: createEmptyDashboardPreAggregates() as DashboardPreAggregates,
      followUps: [] as VacancyFollowUp[]
    } satisfies DashboardSnapshot
  });

  private readonly vacancies = computed(() => this.snapshot().vacancies);
  private readonly preAggregates = computed(() => this.snapshot().preAggregates);
  private readonly followUps = computed(() => this.snapshot().followUps);
  protected readonly analytics = computed<DashboardAnalytics>(() =>
    this.analyticsService.buildAnalytics(this.vacancies(), this.preAggregates())
  );
  protected readonly hasData = computed(() => this.vacancies().length > 0);
  protected readonly hasFollowUpData = computed(() => this.followUps().length > 0);
  protected readonly globalFollowUps = computed<DashboardFollowUpItem[]>(() => {
    const vacancyMap = new Map(this.vacancies().map((vacancy) => [vacancy.id, vacancy]));
    const now = Date.now();

    return this.followUps()
      .filter((followUp) => followUp.status !== 'cancelled')
      .sort((left, right) => new Date(left.plannedDate).getTime() - new Date(right.plannedDate).getTime())
      .slice(0, 6)
      .map((followUp) => {
        const vacancy = vacancyMap.get(followUp.vacancyId);
        const plannedTs = new Date(followUp.plannedDate).getTime();

        return {
          id: followUp.id,
          vacancyId: followUp.vacancyId,
          company: vacancy?.company ?? this.i18nService.translate('common.notAvailable'),
          position: vacancy?.position ?? this.i18nService.translate('common.notAvailable'),
          subject: followUp.subject || this.i18nService.translate('vacancies.followups.defaultSubject'),
          plannedDate: followUp.plannedDate,
          status: followUp.status,
          overdue: followUp.status === 'pending' && plannedTs < now
        };
      });
  });
  protected readonly kpiMetrics = computed<KpiMetric[]>(() => this.analytics().metrics);
  protected readonly nextActions = computed<NextAction[]>(() => this.analytics().nextActions);
  protected readonly recentVacancies = computed<RecentVacancy[]>(() => this.analytics().recentVacancies);
  protected readonly topCompanies = computed<CompanyInteraction[]>(() => this.analytics().topCompanies);
  protected readonly chartLoadingState = signal<Record<ChartKey, boolean>>({
    applications: true,
    status: true,
    modality: true,
    stack: true
  });

  protected readonly locale = this.i18nService.locale;
  protected readonly applicationsChart = computed(() => {
    this.i18nService.language();
    return this.buildApplicationsChart();
  });
  protected readonly statusChart = computed(() => {
    this.i18nService.language();
    return this.buildStatusDonutChart(this.analytics().statusDistribution);
  });
  protected readonly modalityChart = computed(() => {
    this.i18nService.language();
    return this.buildModalityDonutChart(this.analytics().modalityDistribution);
  });
  protected readonly stackChart = computed(() => {
    this.i18nService.language();
    return this.buildStackBarChart(this.analytics().stackBreakdown);
  });

  protected isChartLoading(chart: ChartKey): boolean {
    return this.chartLoadingState()[chart];
  }

  protected onChartMounted(chart: ChartKey): void {
    window.setTimeout(() => {
      this.chartLoadingState.update((currentState) => ({ ...currentState, [chart]: false }));
    }, this.loaderMinDurationMs);
  }

  protected metricTrendClass(metric: KpiMetric): string {
    if (!this.hasData()) {
      return 'trend-no-data';
    }

    if (metric.trendDirection === 'up') {
      return 'trend-up';
    }

    if (metric.trendDirection === 'down') {
      return 'trend-down';
    }

    return 'trend-neutral';
  }

  protected priorityClass(priority: 'Low' | 'Medium' | 'High'): string {
    return `priority-${priority.toLowerCase()}`;
  }

  protected statusClass(status: string | null | undefined): string {
    const normalized = (status ?? 'pending').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `status-${normalized}`;
  }

  protected metricLabel(metricId: string): string {
    const map: Record<string, TranslationKey> = {
      'total-vacancies': 'dashboard.kpi.totalVacancies',
      'cv-sent': 'dashboard.kpi.cvSent',
      applied: 'dashboard.kpi.applied',
      interviews: 'dashboard.kpi.interviews',
      'technical-tests': 'dashboard.kpi.technicalTests',
      rejected: 'dashboard.kpi.rejected',
      'no-response': 'dashboard.kpi.noResponse',
      followups: 'dashboard.kpi.pendingFollowUps'
    };
    return this.i18nService.translate(map[metricId] ?? 'dashboard.kpi.totalVacancies');
  }

  protected metricTrendLabel(metricId: string): string {
    if (!this.hasData()) {
      return this.i18nService.translate('dashboard.noDataYet');
    }

    const metric = this.kpiMetrics().find((item) => item.id === metricId);
    const trendValue = metric?.trendValue ?? 0;
    const signedTrend = trendValue > 0 ? `+${trendValue}` : `${trendValue}`;
    const negativeTrend = trendValue > 0 ? `-${trendValue}` : '0';

    switch (metricId) {
      case 'total-vacancies':
        return this.i18nService.translate('dashboard.kpi.trend.thisWeekDelta', { value: signedTrend });
      case 'cv-sent':
        return this.i18nService.translate('dashboard.kpi.trend.vsLastWeek', { value: signedTrend });
      case 'applied':
        return this.i18nService.translate('dashboard.kpi.trend.active', { value: trendValue });
      case 'interviews':
        return this.i18nService.translate('dashboard.kpi.trend.scheduled', { value: trendValue });
      case 'technical-tests':
        return this.i18nService.translate('dashboard.kpi.trend.pendingReview', { value: trendValue });
      case 'rejected':
        return this.i18nService.translate('dashboard.kpi.trend.thisWeekDelta', { value: negativeTrend });
      case 'no-response':
        return this.i18nService.translate('dashboard.kpi.trend.afterFollowUps', { value: negativeTrend });
      case 'followups':
        return this.i18nService.translate('dashboard.kpi.trend.thisWeek', { value: trendValue });
      default:
        return this.i18nService.translate('dashboard.kpi.trend.vsLastWeek', { value: signedTrend });
    }
  }

  protected statusLabel(status: string): string {
    return this.i18nService.translate(dashboardStatusToTranslationKey(status));
  }

  protected priorityLabel(priority: 'Low' | 'Medium' | 'High'): string {
    const map: Record<'Low' | 'Medium' | 'High', TranslationKey> = {
      Low: 'priority.low',
      Medium: 'priority.medium',
      High: 'priority.high'
    };
    return this.i18nService.translate(map[priority]);
  }

  protected followUpStatusLabel(status: FollowUpStatus): string {
    return this.i18nService.translate(`vacancies.followups.status.${status}`);
  }

  protected followUpStatusClass(status: FollowUpStatus, overdue: boolean): string {
    if (overdue) {
      return 'followup-overdue';
    }

    return `followup-${status}`;
  }

  protected markFollowUpCompleted(followUpId: string): void {
    this.vacancyService.updateFollowUp(followUpId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });
  }

  protected reopenFollowUp(followUpId: string): void {
    this.vacancyService.updateFollowUp(followUpId, {
      status: 'pending',
      completedAt: null
    });
  }

  private buildApplicationsChart(): AreaChartOptions {
    return {
      series: [
        {
          name: this.i18nService.translate('dashboard.applications'),
          data: this.analytics().monthlyApplications.map((item) => item.total)
        }
      ],
      chart: {
        type: 'area',
        height: 290,
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: false },
        sparkline: { enabled: false },
        events: this.chartEvents('applications')
      },
      colors: ['#1d4ed8'],
      stroke: {
        curve: 'smooth',
        width: 3
      },
      fill: {
        type: 'gradient',
        gradient: {
          opacityFrom: 0.35,
          opacityTo: 0.04,
          stops: [0, 90, 100]
        }
      },
      dataLabels: {
        enabled: false
      },
      grid: {
        borderColor: '#dbe5ff',
        strokeDashArray: 4,
        padding: { left: 6, right: 10 }
      },
      xaxis: {
        categories: this.analytics().monthlyApplications.map((item) => this.formatWeeklyCategory(item.month, item.year)),
        labels: {
          style: { colors: '#475569', fontFamily: 'Manrope' }
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        min: 0,
        labels: {
          style: { colors: '#475569', fontFamily: 'Manrope' }
        }
      },
      tooltip: {
        theme: 'light',
        y: {
          formatter: (value: number) => `${value} ${this.i18nService.translate('dashboard.applications').toLowerCase()}`
        }
      }
    };
  }

  private buildStatusDonutChart(distribution: DistributionPoint[]): DonutChartOptions {
    return {
      series: distribution.map((item) => item.value),
      labels: distribution.map((item) => this.statusLabel(item.label)),
      chart: {
        type: 'donut',
        height: 300,
        animations: { enabled: false },
        events: this.chartEvents('status')
      },
      colors: ['#1d4ed8', '#0284c7', '#0f766e', '#f59e0b', '#ef4444', '#7c3aed', '#16a34a'],
      legend: {
        position: 'bottom',
        fontFamily: 'Manrope',
        labels: { colors: '#334155' }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '67%'
          }
        }
      },
      stroke: {
        width: 0
      },
      dataLabels: {
        enabled: false
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${value} ${this.i18nService.translate('dashboard.roles')}`
        }
      },
      responsive: [
        {
          breakpoint: 860,
          options: {
            legend: {
              position: 'bottom'
            }
          }
        }
      ]
    };
  }

  private buildModalityDonutChart(distribution: DistributionPoint[]): DonutChartOptions {
    return {
      series: distribution.map((item) => item.value),
      labels: distribution.map((item) => this.translateModalityLabel(item.label)),
      chart: {
        type: 'donut',
        height: 300,
        animations: { enabled: false },
        events: this.chartEvents('modality')
      },
      colors: ['#1d4ed8', '#0891b2', '#334155'],
      legend: {
        position: 'bottom',
        fontFamily: 'Manrope',
        labels: { colors: '#334155' }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '68%'
          }
        }
      },
      stroke: {
        width: 0
      },
      dataLabels: {
        enabled: false
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${value} ${this.i18nService.translate('dashboard.roles')}`
        }
      },
      responsive: [
        {
          breakpoint: 860,
          options: {
            legend: {
              position: 'bottom'
            }
          }
        }
      ]
    };
  }

  private buildStackBarChart(stackData: StackPoint[]): HorizontalBarOptions {
    return {
      series: [
        {
          name: this.i18nService.translate('dashboard.vacancies'),
          data: stackData.map((item) => item.total)
        }
      ],
      chart: {
        type: 'bar',
        height: 300,
        animations: { enabled: false },
        toolbar: { show: false },
        events: this.chartEvents('stack')
      },
      colors: ['#0f766e'],
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 6,
          barHeight: '58%'
        }
      },
      dataLabels: {
        enabled: false
      },
      grid: {
        borderColor: '#dbe5ff',
        strokeDashArray: 4,
        padding: { left: 2, right: 12 }
      },
      xaxis: {
        categories: stackData.map((item) => item.stack),
        labels: {
          style: { colors: '#475569', fontFamily: 'Manrope' }
        }
      },
      yaxis: {
        labels: {
          style: { colors: '#334155', fontFamily: 'Manrope' }
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${value} ${this.i18nService.translate('dashboard.vacancies').toLowerCase()}`
        }
      }
    };
  }

  private translateMonth(month: string): string {
    const normalized = month.toLowerCase();
    const monthMap: Record<string, TranslationKey> = {
      jan: 'dashboard.month.jan',
      feb: 'dashboard.month.feb',
      mar: 'dashboard.month.mar',
      apr: 'dashboard.month.apr',
      may: 'dashboard.month.may',
      jun: 'dashboard.month.jun',
      jul: 'dashboard.month.jul',
      aug: 'dashboard.month.aug',
      sep: 'dashboard.month.sep',
      oct: 'dashboard.month.oct',
      nov: 'dashboard.month.nov',
      dec: 'dashboard.month.dec'
    };

    return this.i18nService.translate(monthMap[normalized] ?? 'dashboard.month.jan');
  }

  private formatWeeklyCategory(label: string, year?: number): string {
    if (label.startsWith('W')) {
      const shortYear = year ? `${year}`.slice(-2) : '';
      return shortYear ? `${label}-${shortYear}` : label;
    }

    return label;
  }

  private translateModalityLabel(label: string): string {
    const normalized = label.toLowerCase().replace('-', '_');
    const modalityMap: Record<string, 'modality.remote' | 'modality.hybrid' | 'modality.on_site'> = {
      remote: 'modality.remote',
      hybrid: 'modality.hybrid',
      on_site: 'modality.on_site'
    };

    return this.i18nService.translate(modalityMap[normalized] ?? 'modality.remote');
  }

  private chartEvents(chart: ChartKey): ApexChart['events'] {
    return {
      mounted: () => this.onChartMounted(chart)
    };
  }
}
