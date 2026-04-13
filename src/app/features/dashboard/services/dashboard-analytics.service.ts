import { Injectable } from '@angular/core';

import { DashboardAnalytics } from '../models/dashboard-analytics.model';

@Injectable({
  providedIn: 'root'
})
export class DashboardAnalyticsService {
  public getAnalytics(): DashboardAnalytics {
    return {
      metrics: [
        { id: 'total-vacancies', label: 'Total Vacancies', value: 47, trendLabel: '+6 this month', trendDirection: 'up' },
        { id: 'cv-sent', label: 'CV Sent', value: 42, trendLabel: '+4 vs last month', trendDirection: 'up' },
        { id: 'applied', label: 'Applied', value: 36, trendLabel: '+5 active', trendDirection: 'up' },
        { id: 'interviews', label: 'Interviews', value: 11, trendLabel: '+2 scheduled', trendDirection: 'up' },
        { id: 'technical-tests', label: 'Technical Tests', value: 8, trendLabel: '1 pending review', trendDirection: 'neutral' },
        { id: 'rejected', label: 'Rejected', value: 9, trendLabel: '-1 this month', trendDirection: 'down' },
        { id: 'no-response', label: 'No Response', value: 14, trendLabel: '-3 after follow-ups', trendDirection: 'down' },
        { id: 'followups', label: 'Pending Follow-ups', value: 7, trendLabel: '3 due this week', trendDirection: 'neutral' }
      ],
      monthlyApplications: [
        { month: 'May', total: 3 },
        { month: 'Jun', total: 4 },
        { month: 'Jul', total: 2 },
        { month: 'Aug', total: 5 },
        { month: 'Sep', total: 6 },
        { month: 'Oct', total: 4 },
        { month: 'Nov', total: 5 },
        { month: 'Dec', total: 3 },
        { month: 'Jan', total: 8 },
        { month: 'Feb', total: 9 },
        { month: 'Mar', total: 11 },
        { month: 'Apr', total: 10 }
      ],
      statusDistribution: [
        { label: 'In Review', value: 12 },
        { label: 'Interview', value: 11 },
        { label: 'Technical Test', value: 8 },
        { label: 'No Response', value: 14 },
        { label: 'Rejected', value: 9 },
        { label: 'Finalist', value: 4 },
        { label: 'Hired', value: 1 }
      ],
      modalityDistribution: [
        { label: 'Remote', value: 23 },
        { label: 'Hybrid', value: 17 },
        { label: 'On-site', value: 7 }
      ],
      stackBreakdown: [
        { stack: 'Node.js', total: 18 },
        { stack: 'TypeScript', total: 16 },
        { stack: 'Java + Spring', total: 10 },
        { stack: 'Python', total: 9 },
        { stack: 'Go', total: 7 },
        { stack: 'PostgreSQL', total: 14 }
      ],
      recentActivity: [
        {
          id: 'act-01',
          title: 'Interview confirmed',
          detail: 'Technical interview with Datadog for Backend Engineer II.',
          type: 'interview',
          occurredAt: '2026-04-13T10:45:00.000Z'
        },
        {
          id: 'act-02',
          title: 'Status moved to In Review',
          detail: 'Stripe acknowledged your application for API Platform Engineer.',
          type: 'status_update',
          occurredAt: '2026-04-12T16:15:00.000Z'
        },
        {
          id: 'act-03',
          title: 'Follow-up sent',
          detail: 'Sent follow-up email to Personio after 10 business days.',
          type: 'follow_up',
          occurredAt: '2026-04-11T08:10:00.000Z'
        },
        {
          id: 'act-04',
          title: 'Positive recruiter response',
          detail: 'Recruiter from Zalando asked for availability this week.',
          type: 'response',
          occurredAt: '2026-04-10T14:35:00.000Z'
        }
      ],
      nextActions: [
        {
          id: 'next-01',
          title: 'Prepare system design interview',
          company: 'Datadog',
          dueDate: '2026-04-16',
          priority: 'High'
        },
        {
          id: 'next-02',
          title: 'Send follow-up message',
          company: 'HubSpot',
          dueDate: '2026-04-17',
          priority: 'Medium'
        },
        {
          id: 'next-03',
          title: 'Finalize coding challenge',
          company: 'Miro',
          dueDate: '2026-04-18',
          priority: 'High'
        },
        {
          id: 'next-04',
          title: 'Update CV for platform role',
          company: 'Adevinta',
          dueDate: '2026-04-20',
          priority: 'Low'
        }
      ],
      recentVacancies: [
        {
          id: 'vac-101',
          company: 'Stripe',
          role: 'Backend API Engineer',
          status: 'In Review',
          priority: 'High',
          updatedAt: '2026-04-13T11:20:00.000Z'
        },
        {
          id: 'vac-102',
          company: 'Datadog',
          role: 'Backend Engineer II',
          status: 'Interview',
          priority: 'High',
          updatedAt: '2026-04-13T09:05:00.000Z'
        },
        {
          id: 'vac-103',
          company: 'Miro',
          role: 'Platform Backend Developer',
          status: 'Technical Test',
          priority: 'Medium',
          updatedAt: '2026-04-12T17:45:00.000Z'
        },
        {
          id: 'vac-104',
          company: 'Personio',
          role: 'Java Backend Engineer',
          status: 'No Response',
          priority: 'Medium',
          updatedAt: '2026-04-11T08:10:00.000Z'
        },
        {
          id: 'vac-105',
          company: 'Zalando',
          role: 'Backend Engineer - Fulfillment',
          status: 'HR Contact',
          priority: 'High',
          updatedAt: '2026-04-10T14:35:00.000Z'
        }
      ],
      topCompanies: [
        {
          company: 'Stripe',
          touches: 5,
          currentStatus: 'In Review',
          lastContactAt: '2026-04-13T11:20:00.000Z'
        },
        {
          company: 'Datadog',
          touches: 4,
          currentStatus: 'Interview',
          lastContactAt: '2026-04-13T10:45:00.000Z'
        },
        {
          company: 'Miro',
          touches: 4,
          currentStatus: 'Technical Test',
          lastContactAt: '2026-04-12T17:45:00.000Z'
        },
        {
          company: 'HubSpot',
          touches: 3,
          currentStatus: 'No Response',
          lastContactAt: '2026-04-08T12:05:00.000Z'
        }
      ],
      progress: {
        applicationsGoal: 60,
        applicationsDone: 47,
        interviewsGoal: 15,
        interviewsDone: 11,
        followUpsGoal: 24,
        followUpsDone: 17
      }
    };
  }
}
