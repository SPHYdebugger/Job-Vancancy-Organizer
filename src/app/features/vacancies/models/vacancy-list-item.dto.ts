import { Vacancy } from '../../../core/models/vacancy.model';

export interface VacancyListItemDto {
  id: string;
  company: string;
  position: string;
  domain: string;
  headquarters: string;
  contactName: string;
  notes: string;
  tags: string[];
  techStack: string[];
  applicationStatus: Vacancy['applicationStatus'];
  modality: Vacancy['modality'];
  priority: Vacancy['priority'];
  applicationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardVacancyDto {
  id: string;
  company: string;
  position: string;
  techStack: string[];
  applicationStatus: Vacancy['applicationStatus'];
  modality: Vacancy['modality'];
  priority: Vacancy['priority'];
  createdAt: string;
  discoveredAt: string | null;
  applicationDate: string | null;
  updatedAt: string;
  followUpPending: boolean;
  nextFollowUpDate: string | null;
  lastStatusChangeAt: string | null;
}
