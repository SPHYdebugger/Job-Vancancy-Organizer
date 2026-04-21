export type VacancyModality = 'remote' | 'hybrid' | 'on_site';

export type VacancyStatus =
  | 'draft'
  | 'saved'
  | 'cv_sent'
  | 'applied'
  | 'in_review'
  | 'hr_contact'
  | 'interview'
  | 'technical_test'
  | 'offer'
  | 'finalist'
  | 'hired'
  | 'rejected'
  | 'withdrawn'
  | 'no_response'
  | 'archived'
  | 'pending';

export type CompanyResponseStatus = 'none' | 'pending' | 'positive' | 'negative';

export type PriorityLevel = 'low' | 'medium' | 'high';

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'freelance'
  | 'internship'
  | 'temporary'
  | 'other';

export type SeniorityLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'lead' | 'manager' | 'unknown';

// Backward compatible aliases used by the current UI layer.
export type WorkModality = VacancyModality;
export type VacancyPriority = PriorityLevel;
export type CompanyResponseState = CompanyResponseStatus;

export interface Vacancy {
  id: string;
  deletedAt: string | null;

  // Audit
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  closedAt: string | null;

  // Job data
  company: string;
  position: string;
  domain: string | null;
  location: string | null;
  headquarters: string | null;
  modality: VacancyModality;
  employmentType: EmploymentType;
  seniority: SeniorityLevel;

  // Offer
  techStack: string[];
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;

  // Source
  offerSource: string | null;
  sourceType: 'job_board' | 'recruiter' | 'referral' | 'company_site' | 'networking' | 'other';
  offerUrl: string | null;
  companyUrl: string | null;

  // Contact
  contactName: string | null;
  contactEmail: string | null;
  contactLinkedin: string | null;
  lastContactAt: string | null;

  // Current state
  applicationStatus: VacancyStatus;
  processStage: string | null;
  companyResponse: CompanyResponseStatus;
  priority: PriorityLevel;

  // Key dates
  discoveredAt: string | null;
  applicationDate: string | null;
  lastStatusChangeAt: string | null;
  nextFollowUpDate: string | null;

  // Flags
  followUpPending: boolean;
  favorite: boolean;
  archived: boolean;

  // Closure
  rejectionReason: string | null;
  closureReason: string | null;

  // Notes
  notes: string | null;
  hrObservations: string | null;
  tags: string[];
}
