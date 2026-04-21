import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import { Vacancy } from '../../../core/models/vacancy.model';
import { ExcelVacancyRow } from './excel-vacancy-row.model';
import { VacancyMapperService } from './vacancy-mapper.service';

export interface ParsedExcelResult {
  mode: 'vacancies' | 'snapshot';
  vacancies: Vacancy[];
  events: VacancyEvent[];
  followUps: VacancyFollowUp[];
  skippedRows: number;
}

@Injectable({
  providedIn: 'root'
})
export class VacancyExcelImportService {
  constructor(private readonly vacancyMapperService: VacancyMapperService) {}

  public async importFromFile(file: File): Promise<ParsedExcelResult> {
    const workbookBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(workbookBuffer, { type: 'array' });
    const vacanciesSheetName =
      workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'vacancies') ?? workbook.SheetNames[0];

    if (!vacanciesSheetName) {
      return { mode: 'vacancies', vacancies: [], events: [], followUps: [], skippedRows: 0 };
    }

    const vacanciesSheet = workbook.Sheets[vacanciesSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(vacanciesSheet, {
      defval: ''
    });

    const vacancies: Vacancy[] = [];
    let skippedRows = 0;

    for (let index = 0; index < rawRows.length; index += 1) {
      const row = rawRows[index];
      if (this.isExportedVacancyRow(row)) {
        const exportedVacancy = this.mapExportedVacancyRow(row);
        if (!exportedVacancy) {
          skippedRows += 1;
          continue;
        }

        vacancies.push(exportedVacancy);
        continue;
      }

      const mappedRow = this.mapMinimalOrStandardRow(row);

      if (!mappedRow.company) {
        skippedRows += 1;
        continue;
      }

      vacancies.push(
        this.vacancyMapperService.fromExcelRow(mappedRow, crypto.randomUUID(), {
          markAsFake: false
        })
      );
    }

    const parsedEvents = this.parseEventsSheet(workbook, new Set(vacancies.map((vacancy) => vacancy.id)));
    const parsedFollowUps = this.parseFollowUpsSheet(workbook, new Set(vacancies.map((vacancy) => vacancy.id)));
    const hasStructuredSheets = parsedEvents.length > 0 || parsedFollowUps.length > 0;

    return {
      mode: hasStructuredSheets ? 'snapshot' : 'vacancies',
      vacancies,
      events: parsedEvents,
      followUps: parsedFollowUps,
      skippedRows
    };
  }

  private mapMinimalOrStandardRow(row: Record<string, unknown>): ExcelVacancyRow {
    const getString = (value: unknown): string => `${value ?? ''}`.trim();
    const pick = (...keys: string[]): string => {
      for (const key of keys) {
        if (key in row) {
          const value = getString(row[key]);
          if (value) {
            return value;
          }
        }
      }
      return '';
    };

    return {
      date: pick('applicationDate', 'createdAt', 'date'),
      company: pick('company'),
      position: pick('position'),
      domain: pick('domain'),
      headquarters: pick('headquarters', 'location'),
      contact: pick('contactName', 'contact'),
      contactDate: pick('lastContactAt', 'contactDate'),
      message: pick('notes', 'message'),
      cv: pick('cv'),
      response: pick('companyResponse', 'response')
    };
  }

  private isExportedVacancyRow(row: Record<string, unknown>): boolean {
    return ['id', 'company', 'position', 'applicationStatus', 'createdAt'].some((key) => key in row);
  }

  private parseEventsSheet(workbook: XLSX.WorkBook, vacancyIds: Set<string>): VacancyEvent[] {
    const eventsSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'events');
    if (!eventsSheetName) {
      return [];
    }

    const eventsSheet = workbook.Sheets[eventsSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(eventsSheet, { defval: '' });
    const now = new Date().toISOString();

    return rawRows
      .map((row) => {
        const vacancyId = this.asString(row['vacancyId']);
        const title = this.asString(row['title']);
        const type = this.asString(row['type']) as VacancyEvent['type'] | null;

        if (!vacancyId || !vacancyIds.has(vacancyId) || !type || !title) {
          return null;
        }

        return {
          id: this.asString(row['id']) ?? `evt_${crypto.randomUUID()}`,
          deletedAt: this.asNullableString(row['deletedAt']),
          vacancyId,
          type,
          title,
          description: this.asString(row['description']) ?? '',
          previousStatus: (this.asString(row['previousStatus']) as VacancyEvent['previousStatus']) ?? null,
          newStatus: (this.asString(row['newStatus']) as VacancyEvent['newStatus']) ?? null,
          eventAt: this.asString(row['eventAt']) ?? now,
          createdAt: this.asString(row['createdAt']) ?? now,
          actorType: (this.asString(row['actorType']) as VacancyEvent['actorType']) ?? 'user',
          actorId: this.asNullableString(row['actorId']),
          metadata: this.readEventMetadata(row)
        } satisfies VacancyEvent;
      })
      .filter((event): event is VacancyEvent => Boolean(event));
  }

  private parseFollowUpsSheet(workbook: XLSX.WorkBook, vacancyIds: Set<string>): VacancyFollowUp[] {
    const followUpsSheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'followups');
    if (!followUpsSheetName) {
      return [];
    }

    const followUpsSheet = workbook.Sheets[followUpsSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(followUpsSheet, { defval: '' });
    const now = new Date().toISOString();

    return rawRows
      .map((row) => {
        const vacancyId = this.asString(row['vacancyId']);
        if (!vacancyId || !vacancyIds.has(vacancyId)) {
          return null;
        }

        return {
          id: this.asString(row['id']) ?? `fol_${crypto.randomUUID()}`,
          deletedAt: this.asNullableString(row['deletedAt']),
          vacancyId,
          plannedDate: this.asString(row['plannedDate']) ?? now,
          completedAt: this.asNullableString(row['completedAt']),
          status: (this.asString(row['status']) as VacancyFollowUp['status']) ?? 'pending',
          channel: (this.asString(row['channel']) as VacancyFollowUp['channel']) ?? 'email',
          subject: this.asString(row['subject']) ?? '',
          message: this.asString(row['message']) ?? '',
          responseReceived: this.asBoolean(row['responseReceived']),
          responseSummary: this.asString(row['responseSummary']) ?? '',
          createdAt: this.asString(row['createdAt']) ?? now,
          updatedAt: this.asString(row['updatedAt']) ?? now
        } satisfies VacancyFollowUp;
      })
      .filter((followUp): followUp is VacancyFollowUp => Boolean(followUp));
  }

  private mapExportedVacancyRow(row: Record<string, unknown>): Vacancy | null {
    const company = this.asString(row['company']);
    const position = this.asString(row['position']);
    if (!company || !position) {
      return null;
    }

    const now = new Date().toISOString();

    return {
      id: this.asString(row['id']) ?? crypto.randomUUID(),
      deletedAt: this.asNullableString(row['deletedAt']),
      createdAt: this.asString(row['createdAt']) ?? now,
      updatedAt: this.asString(row['updatedAt']) ?? now,
      archivedAt: this.asNullableString(row['archivedAt']),
      closedAt: this.asNullableString(row['closedAt']),
      company,
      position,
      domain: this.asNullableString(row['domain']),
      location: this.asNullableString(row['location']),
      headquarters: this.asNullableString(row['headquarters']),
      modality: this.parseModality(this.asString(row['modality'])),
      employmentType: (this.asString(row['employmentType']) as Vacancy['employmentType']) ?? 'full_time',
      seniority: (this.asString(row['seniority']) as Vacancy['seniority']) ?? 'unknown',
      techStack: this.asStringArray(row['techStack']),
      salaryText: this.asNullableString(row['salaryText']),
      salaryMin: this.asNullableNumber(row['salaryMin']),
      salaryMax: this.asNullableNumber(row['salaryMax']),
      salaryCurrency: this.asNullableString(row['salaryCurrency']),
      offerSource: this.asNullableString(row['offerSource']),
      sourceType: (this.asString(row['sourceType']) as Vacancy['sourceType']) ?? 'job_board',
      offerUrl: this.asNullableString(row['offerUrl']),
      companyUrl: this.asNullableString(row['companyUrl']),
      contactName: this.asNullableString(row['contactName']),
      contactEmail: this.asNullableString(row['contactEmail']),
      contactLinkedin: this.asNullableString(row['contactLinkedin']),
      lastContactAt: this.asNullableString(row['lastContactAt']),
      applicationStatus: this.parseApplicationStatus(this.asString(row['applicationStatus'])),
      processStage: this.asNullableString(row['processStage']),
      companyResponse: this.parseCompanyResponse(this.asString(row['companyResponse'])),
      priority: this.parsePriority(this.asString(row['priority'])),
      discoveredAt: this.asNullableString(row['discoveredAt']),
      applicationDate: this.asNullableString(row['applicationDate']),
      lastStatusChangeAt: this.asNullableString(row['lastStatusChangeAt']),
      nextFollowUpDate: this.asNullableString(row['nextFollowUpDate']),
      followUpPending: this.asBoolean(row['followUpPending']),
      favorite: this.asBoolean(row['favorite']),
      archived: this.asBoolean(row['archived']),
      rejectionReason: this.asNullableString(row['rejectionReason']),
      closureReason: this.asNullableString(row['closureReason']),
      notes: this.asNullableString(row['notes']),
      hrObservations: this.asNullableString(row['hrObservations']),
      tags: this.asStringArray(row['tags'])
    };
  }

  private asString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  private asNullableString(value: unknown): string | null {
    return this.asString(value);
  }

  private readEventMetadata(row: Record<string, unknown>): VacancyEvent['metadata'] {
    const attachments = this.asStringArray(row['metadata.attachments']);
    const rawCustomFields = this.asString(row['metadata.customFields']);
    let customFields: Record<string, unknown> | undefined;

    if (rawCustomFields) {
      try {
        const parsedValue = JSON.parse(rawCustomFields);
        if (parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)) {
          customFields = parsedValue as Record<string, unknown>;
        }
      } catch {
        customFields = { raw: rawCustomFields };
      }
    }

    return {
      contactName: this.asNullableString(row['metadata.contactName']) ?? undefined,
      companyResponse:
        (this.asString(row['metadata.companyResponse']) as VacancyEvent['metadata']['companyResponse']) ?? undefined,
      interviewType: (this.asString(row['metadata.interviewType']) as VacancyEvent['metadata']['interviewType']) ?? undefined,
      interviewResult:
        (this.asString(row['metadata.interviewResult']) as VacancyEvent['metadata']['interviewResult']) ?? undefined,
      followUpDate: this.asNullableString(row['metadata.followUpDate']) ?? undefined,
      offerUrl: this.asNullableString(row['metadata.offerUrl']) ?? undefined,
      messageSnapshot: this.asNullableString(row['metadata.messageSnapshot']) ?? undefined,
      rejectionReason: this.asNullableString(row['metadata.rejectionReason']) ?? undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
      customFields
    };
  }

  private asNullableNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value.trim());
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private asBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['true', '1', 'yes', 'y'].includes(normalized);
    }

    if (typeof value === 'number') {
      return value === 1;
    }

    return false;
  }

  private asStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((item) => `${item}`.trim()).filter((item) => item.length > 0);
    }

    if (typeof value !== 'string') {
      return [];
    }

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(trimmedValue);
      if (Array.isArray(parsedValue)) {
        return parsedValue.map((item) => `${item}`.trim()).filter((item) => item.length > 0);
      }
    } catch {
      // If it is not a JSON array, fallback to comma-separated parsing.
    }

    return trimmedValue
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  private parseApplicationStatus(value: string | null): Vacancy['applicationStatus'] {
    const normalized = (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');
    const allowed = new Set<Vacancy['applicationStatus']>([
      'draft',
      'saved',
      'pending',
      'cv_sent',
      'applied',
      'in_review',
      'hr_contact',
      'interview',
      'technical_test',
      'offer',
      'finalist',
      'rejected',
      'withdrawn',
      'no_response',
      'hired',
      'archived'
    ]);

    return allowed.has(normalized as Vacancy['applicationStatus']) ? (normalized as Vacancy['applicationStatus']) : 'pending';
  }

  private parsePriority(value: string | null): Vacancy['priority'] {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'high' || normalized === 'medium' || normalized === 'low') {
      return normalized;
    }
    return 'medium';
  }

  private parseModality(value: string | null): Vacancy['modality'] {
    const normalized = (value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_');

    if (normalized === 'remote' || normalized === 'hybrid' || normalized === 'on_site') {
      return normalized;
    }

    if (normalized === 'onsite') {
      return 'on_site';
    }

    return 'remote';
  }

  private parseCompanyResponse(value: string | null): Vacancy['companyResponse'] {
    const normalized = (value ?? '').trim().toLowerCase();
    if (normalized === 'none' || normalized === 'pending' || normalized === 'positive' || normalized === 'negative') {
      return normalized;
    }
    return 'none';
  }
}
