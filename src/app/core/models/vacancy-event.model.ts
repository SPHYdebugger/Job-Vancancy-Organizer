import { CompanyResponseStatus, VacancyStatus } from './vacancy.model';

export type VacancyEventType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'cv_sent'
  | 'applied'
  | 'message_sent'
  | 'follow_up_scheduled'
  | 'follow_up_sent'
  | 'response_received'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'technical_test_sent'
  | 'technical_test_completed'
  | 'offer_received'
  | 'offer_rejected'
  | 'hired'
  | 'rejected'
  | 'withdrawn'
  | 'note_added'
  | 'archived';

export interface VacancyEvent {
  id: string;
  vacancyId: string;
  type: VacancyEventType;
  title: string;
  description: string;
  previousStatus: VacancyStatus | null;
  newStatus: VacancyStatus | null;
  eventAt: string;
  createdAt: string;
  actorType: 'user' | 'system';
  actorId: string | null;
  metadata: {
    contactName?: string;
    companyResponse?: CompanyResponseStatus;
    interviewType?: 'hr' | 'technical' | 'final' | 'other';
    interviewResult?: 'pending' | 'passed' | 'failed' | 'unknown';
    followUpDate?: string;
    offerUrl?: string;
    messageSnapshot?: string;
    rejectionReason?: string;
    attachments?: string[];
    customFields?: Record<string, unknown>;
  };
}

