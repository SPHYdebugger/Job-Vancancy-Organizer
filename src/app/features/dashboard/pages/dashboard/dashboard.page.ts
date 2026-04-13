import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
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

import { DashboardAnalyticsService } from '../../services/dashboard-analytics.service';
import {
  CompanyInteraction,
  DashboardAnalytics,
  DistributionPoint,
  KpiMetric,
  NextAction,
  ProgressSnapshot,
  RecentVacancy,
  StackPoint
} from '../../models/dashboard-analytics.model';

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

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatProgressBarModule,
    MatChipsModule,
    NgApexchartsModule
  ],
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('staggerCards', [
      transition(':enter', [
        query(
          '.kpi-card',
          [
            style({ opacity: 0, transform: 'translateY(14px)' }),
            stagger(70, animate('320ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'translateY(0)' })))
          ],
          { optional: true }
        )
      ])
    ]),
    trigger('fadeSlide', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('300ms 70ms cubic-bezier(0.2, 0, 0, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class DashboardPageComponent {
  private readonly analyticsService = inject(DashboardAnalyticsService);

  protected readonly analytics: DashboardAnalytics = this.analyticsService.getAnalytics();
  protected readonly kpiMetrics: KpiMetric[] = this.analytics.metrics;
  protected readonly nextActions: NextAction[] = this.analytics.nextActions;
  protected readonly recentVacancies: RecentVacancy[] = this.analytics.recentVacancies;
  protected readonly topCompanies: CompanyInteraction[] = this.analytics.topCompanies;
  protected readonly progress = this.analytics.progress;

  protected readonly applicationsChart = this.buildApplicationsChart();
  protected readonly statusChart = this.buildStatusDonutChart(this.analytics.statusDistribution);
  protected readonly modalityChart = this.buildModalityDonutChart(this.analytics.modalityDistribution);
  protected readonly stackChart = this.buildStackBarChart(this.analytics.stackBreakdown);

  protected readonly globalProgress = computed(() => this.calculateGlobalProgress(this.progress));

  protected metricTrendClass(metric: KpiMetric): string {
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

  protected statusClass(status: string): string {
    return `status-${status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  }

  private buildApplicationsChart(): AreaChartOptions {
    return {
      series: [
        {
          name: 'Applications',
          data: this.analytics.monthlyApplications.map((item) => item.total)
        }
      ],
      chart: {
        type: 'area',
        height: 290,
        toolbar: { show: false },
        zoom: { enabled: false },
        sparkline: { enabled: false }
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
        categories: this.analytics.monthlyApplications.map((item) => item.month),
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
          formatter: (value: number) => `${value} applications`
        }
      }
    };
  }

  private buildStatusDonutChart(distribution: DistributionPoint[]): DonutChartOptions {
    return {
      series: distribution.map((item) => item.value),
      labels: distribution.map((item) => item.label),
      chart: {
        type: 'donut',
        height: 300
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
          formatter: (value: number) => `${value} roles`
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
      labels: distribution.map((item) => item.label),
      chart: {
        type: 'donut',
        height: 300
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
          formatter: (value: number) => `${value} roles`
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
          name: 'Vacancies',
          data: stackData.map((item) => item.total)
        }
      ],
      chart: {
        type: 'bar',
        height: 300,
        toolbar: { show: false }
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
          formatter: (value: number) => `${value} vacancies`
        }
      }
    };
  }

  private calculateGlobalProgress(progress: ProgressSnapshot): number {
    const applicationsRatio = progress.applicationsDone / progress.applicationsGoal;
    const interviewsRatio = progress.interviewsDone / progress.interviewsGoal;
    const followUpsRatio = progress.followUpsDone / progress.followUpsGoal;

    const weightedScore = applicationsRatio * 0.45 + interviewsRatio * 0.35 + followUpsRatio * 0.2;
    return Math.round(Math.min(weightedScore * 100, 100));
  }
}
