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

    return {
      id,
      createdAt: row.date,
      company: companyName,
      position: roleName,
      domain: row.domain,
      headquarters: row.headquarters,
      modality: 'remote',
      techStack: ['TypeScript', 'Node.js'],
      salary: 'Not specified',
      offerSource: 'Imported from Excel',
      offerUrl: '',
      companyUrl: '',
      contactName: row.contact,
      contactDate: row.contactDate || null,
      message: row.message,
      cvSent: this.parseBooleanValue(row.cv),
      responseReceived: this.parseBooleanValue(row.response),
      applicationStatus: 'pending',
      processStage: 'Imported',
      priority: 'medium',
      applicationDate: row.date || null,
      lastUpdatedAt: now,
      interviewCompleted: false,
      technicalInterview: false,
      companyResponse: 'none',
      rejected: false,
      rejectionReason: '',
      followUpPending: false,
      nextFollowUpDate: null,
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
