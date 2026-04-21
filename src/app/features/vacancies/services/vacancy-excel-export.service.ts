import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import { Vacancy } from '../../../core/models/vacancy.model';

@Injectable({
  providedIn: 'root'
})
export class VacancyExcelExportService {
  private readonly vacancyColumns: ReadonlyArray<keyof Vacancy> = [
    'id',
    'deletedAt',
    'createdAt',
    'updatedAt',
    'archivedAt',
    'closedAt',
    'company',
    'position',
    'domain',
    'location',
    'headquarters',
    'modality',
    'employmentType',
    'seniority',
    'techStack',
    'salaryText',
    'salaryMin',
    'salaryMax',
    'salaryCurrency',
    'offerSource',
    'sourceType',
    'offerUrl',
    'companyUrl',
    'contactName',
    'contactEmail',
    'contactLinkedin',
    'lastContactAt',
    'applicationStatus',
    'processStage',
    'companyResponse',
    'priority',
    'discoveredAt',
    'applicationDate',
    'lastStatusChangeAt',
    'nextFollowUpDate',
    'followUpPending',
    'favorite',
    'archived',
    'rejectionReason',
    'closureReason',
    'notes',
    'hrObservations',
    'tags'
  ];

  private readonly eventColumns: ReadonlyArray<string> = [
    'id',
    'deletedAt',
    'vacancyId',
    'type',
    'title',
    'description',
    'previousStatus',
    'newStatus',
    'eventAt',
    'createdAt',
    'actorType',
    'actorId',
    'metadata.contactName',
    'metadata.companyResponse',
    'metadata.interviewType',
    'metadata.interviewResult',
    'metadata.followUpDate',
    'metadata.offerUrl',
    'metadata.messageSnapshot',
    'metadata.rejectionReason',
    'metadata.attachments',
    'metadata.customFields'
  ];

  private readonly followUpColumns: ReadonlyArray<keyof VacancyFollowUp> = [
    'id',
    'vacancyId',
    'plannedDate',
    'completedAt',
    'status',
    'channel',
    'subject',
    'message',
    'responseReceived',
    'responseSummary',
    'createdAt',
    'updatedAt'
  ];

  public exportSnapshot(input: {
    vacancies: Vacancy[];
    events: VacancyEvent[];
    followUps: VacancyFollowUp[];
    fileName?: string;
  }): void {
    const workbook = XLSX.utils.book_new();

    const vacanciesRows = this.toVacancyRows(input.vacancies);
    const eventsRows = this.toEventRows(input.events);
    const followUpsRows = this.toFollowUpRows(input.followUps);

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(vacanciesRows), 'Vacancies');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(eventsRows), 'Events');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(followUpsRows), 'FollowUps');

    const now = new Date();
    const fallbackName = `vacancies_export_${now.getFullYear()}-${this.pad(now.getMonth() + 1)}-${this.pad(now.getDate())}_${this.pad(now.getHours())}-${this.pad(now.getMinutes())}.xlsx`;
    XLSX.writeFile(workbook, input.fileName || fallbackName);
  }

  private toVacancyRows(vacancies: Vacancy[]): Array<Record<string, string | number | boolean | null>> {
    return vacancies.map((vacancy) => {
      const row: Record<string, string | number | boolean | null> = {};
      for (const column of this.vacancyColumns) {
        row[column] = this.serializeScalar(vacancy[column]);
      }
      return row;
    });
  }

  private toEventRows(events: VacancyEvent[]): Array<Record<string, string | number | boolean | null>> {
    return events.map((event) => {
      const row: Record<string, string | number | boolean | null> = {};
      for (const column of this.eventColumns) {
        row[column] = this.getEventColumnValue(event, column);
      }
      return row;
    });
  }

  private toFollowUpRows(followUps: VacancyFollowUp[]): Array<Record<string, string | number | boolean | null>> {
    return followUps.map((followUp) => {
      const row: Record<string, string | number | boolean | null> = {};
      for (const column of this.followUpColumns) {
        row[column] = this.serializeScalar(followUp[column]);
      }
      return row;
    });
  }

  private getEventColumnValue(event: VacancyEvent, column: string): string | number | boolean | null {
    if (column.startsWith('metadata.')) {
      const metadataKey = column.replace('metadata.', '') as keyof VacancyEvent['metadata'];
      const metadataValue = event.metadata?.[metadataKey];
      return this.serializeScalar(metadataValue as unknown);
    }

    const value = (event as unknown as Record<string, unknown>)[column];
    return this.serializeScalar(value);
  }

  private serializeScalar(value: unknown): string | number | boolean | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return `${value}`;
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
