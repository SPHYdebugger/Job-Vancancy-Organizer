export type VacancyStatus =
  | 'pending'
  | 'cv_sent'
  | 'applied'
  | 'in_review'
  | 'hr_contact'
  | 'interview'
  | 'technical_test'
  | 'finalist'
  | 'rejected'
  | 'no_response'
  | 'hired';

export type VacancyPriority = 'low' | 'medium' | 'high';

export type WorkModality = 'remote' | 'hybrid' | 'on_site';

export type CompanyResponseState = 'none' | 'pending' | 'positive' | 'negative';

export interface Vacancy {
  id: string;
  createdAt: string;
  company: string;
  position: string;
  domain: string;
  headquarters: string;
  modality: WorkModality;
  techStack: string[];
  salary: string;
  offerSource: string;
  offerUrl: string;
  companyUrl: string;
  contactName: string;
  contactDate: string | null;
  message: string;
  cvSent: boolean;
  responseReceived: boolean;
  applicationStatus: VacancyStatus;
  processStage: string;
  priority: VacancyPriority;
  applicationDate: string | null;
  lastUpdatedAt: string;
  interviewCompleted: boolean;
  technicalInterview: boolean;
  companyResponse: CompanyResponseState;
  rejected: boolean;
  rejectionReason: string;
  followUpPending: boolean;
  nextFollowUpDate: string | null;
  notes: string;
  hrObservations: string;
  tags: string[];
}
