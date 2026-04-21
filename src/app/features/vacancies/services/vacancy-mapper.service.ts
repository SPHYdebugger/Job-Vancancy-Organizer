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
    const importedPosition = row.position.trim();
    const defaultPosition = importedPosition || 'Backend Developer';
    const roleName = shouldMarkAsFake ? `[FAKE] ${defaultPosition}` : defaultPosition;
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
      domain: row.domain || null,
      location: row.headquarters || null,
      headquarters: row.headquarters || null,
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
      offerUrl: null,
      companyUrl: null,
      contactName: row.contact || null,
      contactEmail: null,
      contactLinkedin: null,
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
      rejectionReason: null,
      closureReason: null,
      notes: row.message || 'Imported from spreadsheet row mapping.',
      hrObservations: null,
      tags: ['seed', 'excel-import']
    };
  }

  private parseBooleanValue(value: string): boolean {
    const normalizedValue = value.trim().toLowerCase();
    return ['yes', 'true', '1', 'sent', 'done'].includes(normalizedValue);
  }
}
