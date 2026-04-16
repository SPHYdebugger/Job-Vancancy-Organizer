export type FollowUpStatus = 'pending' | 'completed' | 'cancelled' | 'expired';

export interface VacancyFollowUp {
  id: string;
  vacancyId: string;
  plannedDate: string;
  completedAt: string | null;
  status: FollowUpStatus;
  channel: 'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other';
  subject: string;
  message: string;
  responseReceived: boolean;
  responseSummary: string;
  createdAt: string;
  updatedAt: string;
}

