import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';
import { Vacancy } from '../../../core/models/vacancy.model';

@Injectable({
  providedIn: 'root'
})
export class VacancyExcelExportService {
  public exportSnapshot(input: {
    vacancies: Vacancy[];
    events: VacancyEvent[];
    followUps: VacancyFollowUp[];
    fileName?: string;
  }): void {
    const workbook = XLSX.utils.book_new();

    const vacanciesRows = this.toTabularRows(input.vacancies);
    const eventsRows = this.toTabularRows(input.events);
    const followUpsRows = this.toTabularRows(input.followUps);

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(vacanciesRows), 'Vacancies');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(eventsRows), 'Events');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(followUpsRows), 'FollowUps');

    const now = new Date();
    const fallbackName = `vacancies_export_${now.getFullYear()}-${this.pad(now.getMonth() + 1)}-${this.pad(now.getDate())}_${this.pad(now.getHours())}-${this.pad(now.getMinutes())}.xlsx`;
    XLSX.writeFile(workbook, input.fileName || fallbackName);
  }

  private toTabularRows<T extends object>(items: T[]): Array<Record<string, string | number | boolean | null>> {
    if (items.length === 0) {
      return [];
    }

    const flattenedRows = items.map((item) => this.flattenRecord(item));
    const allKeys = [...new Set(flattenedRows.flatMap((row) => Object.keys(row)))].sort((left, right) =>
      left.localeCompare(right)
    );

    return flattenedRows.map((row) => {
      const normalizedRow: Record<string, string | number | boolean | null> = {};
      for (const key of allKeys) {
        normalizedRow[key] = row[key] ?? null;
      }
      return normalizedRow;
    });
  }

  private flattenRecord(
    input: object,
    prefix = ''
  ): Record<string, string | number | boolean | null> {
    const output: Record<string, string | number | boolean | null> = {};

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (value === null || value === undefined) {
        output[fullKey] = null;
        continue;
      }

      if (Array.isArray(value)) {
        output[fullKey] = JSON.stringify(value);
        continue;
      }

      const valueType = typeof value;
      if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
        output[fullKey] = value as string | number | boolean;
        continue;
      }

      if (valueType === 'object') {
        Object.assign(output, this.flattenRecord(value as Record<string, unknown>, fullKey));
        continue;
      }

      output[fullKey] = `${value}`;
    }

    return output;
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
