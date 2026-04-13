import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs/operators';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Vacancy } from '../../../../core/models/vacancy.model';
import { VacancyExcelImportService } from '../../services/vacancy-excel-import.service';
import { VacancyService } from '../../services/vacancy.service';

@Component({
  selector: 'app-vacancies-list-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatChipsModule, MatButtonModule, MatSnackBarModule],
  templateUrl: './vacancies-list.page.html',
  styleUrl: './vacancies-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacanciesListPageComponent {
  @ViewChild('excelFileInput') private readonly excelFileInput?: ElementRef<HTMLInputElement>;

  private readonly vacancyService = inject(VacancyService);
  private readonly vacancyExcelImportService = inject(VacancyExcelImportService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly isImporting = signal(false);
  protected readonly vacancies$ = this.vacancyService.watchAll();
  protected readonly totalVacancies$ = this.vacancies$.pipe(map((vacancies) => vacancies.length));

  protected trackById(_: number, vacancy: Vacancy): string {
    return vacancy.id;
  }

  protected deleteVacancy(vacancy: Vacancy): void {
    const shouldDelete = confirm(`Delete "${vacancy.company} - ${vacancy.position}"?`);

    if (!shouldDelete) {
      return;
    }

    this.vacancyService.remove(vacancy.id);
    this.snackBar.open('Vacancy deleted.', 'Close', { duration: 2500 });
  }

  protected openExcelImport(): void {
    this.excelFileInput?.nativeElement.click();
  }

  protected async onExcelFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    this.isImporting.set(true);

    try {
      const importResult = await this.vacancyExcelImportService.importFromFile(file);

      for (const vacancy of importResult.vacancies) {
        this.vacancyService.create(vacancy);
      }

      this.snackBar.open(
        `Imported ${importResult.vacancies.length} vacancies from Excel (${importResult.skippedRows} skipped).`,
        'Close',
        { duration: 4500 }
      );
    } catch {
      this.snackBar.open('Excel import failed. Please verify the file format.', 'Close', {
        duration: 4500
      });
    } finally {
      this.isImporting.set(false);
      input.value = '';
    }
  }
}
