import { Injectable } from '@angular/core';

import { Vacancy } from '../../../core/models/vacancy.model';
import { ExcelVacancyRow } from './excel-vacancy-row.model';

interface VacancyMapperOptions {
  markAsFake?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class VacancyMapperService {
  public fromExcelRow(row: ExcelVacancyRow, id: string, options: VacancyMapperOptions = {}): Vacancy {
    const shouldMarkAsFake = options.markAsFake ?? false;
    const now = new Date().toISOString();
    const companyName = shouldMarkAsFake ? `FAKE ${row.company}` : row.company;
    const roleName = shouldMarkAsFake ? '[FAKE] Backend Developer' : 'Backend Developer';
    const applicationDate = row.date || null;

    return {
      id,
      deletedAt: null,
      createdAt: applicationDate ?? now,
      updatedAt: now,
      archivedAt: null,
      closedAt: null,
      company: companyName,
      position: roleName,
      domain: row.domain,
      location: row.headquarters || 'Unknown',
      headquarters: row.headquarters,
      modality: 'remote',
      employmentType: 'full_time',
      seniority: 'unknown',
      techStack: ['TypeScript', 'Node.js'],
      salaryText: 'Not specified',
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      offerSource: 'Imported from Excel',
      sourceType: 'other',
      offerUrl: '',
      companyUrl: '',
      contactName: row.contact,
      contactEmail: '',
      contactLinkedin: '',
      lastContactAt: row.contactDate || null,
      applicationStatus: 'pending',
      processStage: 'Imported',
      priority: 'medium',
      companyResponse: this.parseBooleanValue(row.response) ? 'positive' : 'none',
      discoveredAt: applicationDate ?? now,
      applicationDate,
      lastStatusChangeAt: now,
      nextFollowUpDate: null,
      followUpPending: false,
      favorite: false,
      archived: false,
      rejectionReason: '',
      closureReason: '',
      notes: 'Imported from spreadsheet row mapping.',
      hrObservations: '',
      tags: ['seed', 'excel-import']
    };
  }

  private parseBooleanValue(value: string): boolean {
    const normalizedValue = value.trim().toLowerCase();
    return ['yes', 'true', '1', 'sent', 'done'].includes(normalizedValue);
  }
}
