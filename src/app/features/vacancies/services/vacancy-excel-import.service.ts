import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

import { Vacancy } from '../../../core/models/vacancy.model';
import { ExcelVacancyRow } from './excel-vacancy-row.model';
import { VacancyMapperService } from './vacancy-mapper.service';

interface ParsedExcelResult {
  vacancies: Vacancy[];
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
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return { vacancies: [], skippedRows: 0 };
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
      defval: ''
    });

    const vacancies: Vacancy[] = [];
    let skippedRows = 0;

    for (let index = 0; index < rawRows.length; index += 1) {
      const row = rawRows[index];
      const mappedRow = this.mapRawRow(row);

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

    return {
      vacancies,
      skippedRows
    };
  }

  private mapRawRow(row: Record<string, unknown>): ExcelVacancyRow {
    const getString = (value: unknown): string => `${value ?? ''}`.trim();

    return {
      date: getString(row['Fecha']),
      company: getString(row['Empresa']),
      domain: getString(row['Ámbito'] ?? row['Ambito']),
      headquarters: getString(row['Sede']),
      contact: getString(row['Contacto']),
      contactDate: getString(row['Fecha Contacto']),
      message: getString(row['Mensaje']),
      cv: getString(row['CV']),
      response: getString(row['Respuesta'])
    };
  }
}
