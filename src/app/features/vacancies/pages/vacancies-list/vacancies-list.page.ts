import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Vacancy } from '../../../../core/models/vacancy.model';
import { VacancyService } from '../../services/vacancy.service';

type SortOption =
  | 'default'
  | 'updated_desc'
  | 'updated_asc'
  | 'company_asc'
  | 'company_desc'
  | 'position_asc'
  | 'position_desc'
  | 'status_asc'
  | 'status_desc'
  | 'modality_asc'
  | 'modality_desc'
  | 'application_desc'
  | 'application_asc'
  | 'priority_desc'
  | 'priority_asc';
type SortColumn = 'company' | 'position' | 'status' | 'modality' | 'application' | 'priority' | 'updated';
type SortDirection = 'asc' | 'desc';

interface VacancyFilters {
  search: string;
  company: string;
  status: string;
  modality: string;
  priority: string;
  stack: string;
  headquarters: string;
  fromDate: string;
  toDate: string;
  sortBy: SortOption;
  pageSize: number;
}

@Component({
  selector: 'app-vacancies-list-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatChipsModule,
    MatButtonModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './vacancies-list.page.html',
  styleUrl: './vacancies-list.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacanciesListPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly vacancyService = inject(VacancyService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly priorityRanking = new Map([
    ['high', 3],
    ['medium', 2],
    ['low', 1]
  ]);

  protected readonly currentPage = signal(0);
  protected readonly pageSizeOptions = [5, 8, 10, 15];

  protected readonly filtersForm = this.formBuilder.nonNullable.group<VacancyFilters>({
    search: '',
    company: 'all',
    status: 'all',
    modality: 'all',
    priority: 'all',
    stack: 'all',
    headquarters: 'all',
    fromDate: '',
    toDate: '',
    sortBy: 'default',
    pageSize: 8
  });

  protected readonly vacancies = toSignal(this.vacancyService.watchAll(), {
    initialValue: [] as Vacancy[]
  });

  private readonly filters = toSignal(
    this.filtersForm.valueChanges.pipe(startWith(this.filtersForm.getRawValue())),
    {
      initialValue: this.filtersForm.getRawValue()
    }
  );

  protected readonly companyOptions = computed(() => this.extractUniqueValues(this.vacancies().map((item) => item.company)));
  protected readonly statusOptions = computed(() =>
    this.extractUniqueValues(this.vacancies().map((item) => item.applicationStatus))
  );
  protected readonly modalityOptions = computed(() =>
    this.extractUniqueValues(this.vacancies().map((item) => item.modality))
  );
  protected readonly priorityOptions = computed(() =>
    this.extractUniqueValues(this.vacancies().map((item) => item.priority))
  );
  protected readonly stackOptions = computed(() =>
    this.extractUniqueValues(this.vacancies().flatMap((item) => item.techStack))
  );
  protected readonly headquartersOptions = computed(() =>
    this.extractUniqueValues(this.vacancies().map((item) => item.headquarters))
  );

  protected readonly filteredVacancies = computed(() =>
    this.applyFilters(this.vacancies(), this.normalizeFilters(this.filters()))
  );
  protected readonly totalVacancies = computed(() => this.vacancies().length);
  protected readonly filteredCount = computed(() => this.filteredVacancies().length);

  protected readonly pageSize = computed(() => this.normalizeFilters(this.filters()).pageSize || 8);
  protected readonly totalPages = computed(() => {
    const count = this.filteredCount();
    return Math.max(1, Math.ceil(count / this.pageSize()));
  });

  protected readonly paginatedVacancies = computed(() => {
    const pageIndex = Math.min(this.currentPage(), this.totalPages() - 1);
    const pageSize = this.pageSize();
    const start = pageIndex * pageSize;
    const end = start + pageSize;

    return this.filteredVacancies().slice(start, end);
  });

  protected readonly pageDisplay = computed(() => `${this.currentPage() + 1} / ${this.totalPages()}`);

  constructor() {
    effect(() => {
      this.filters();
      this.currentPage.set(0);
    });

    effect(() => {
      const maxPageIndex = this.totalPages() - 1;
      if (this.currentPage() > maxPageIndex) {
        this.currentPage.set(Math.max(0, maxPageIndex));
      }
    });
  }

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

  protected clearFilters(): void {
    this.filtersForm.patchValue({
      search: '',
      company: 'all',
      status: 'all',
      modality: 'all',
      priority: 'all',
      stack: 'all',
      headquarters: 'all',
      fromDate: '',
      toDate: '',
      sortBy: 'default',
      pageSize: 8
    });
  }

  protected toggleColumnSort(column: SortColumn): void {
    const currentSort = this.normalizeFilters(this.filters()).sortBy;
    const currentDirection = this.sortDirectionFor(column, currentSort);
    const nextSort =
      currentDirection === null
        ? this.resolveSortOption(column, 'asc')
        : currentDirection === 'asc'
          ? this.resolveSortOption(column, 'desc')
          : 'default';
    this.filtersForm.patchValue({ sortBy: nextSort });
  }

  protected getColumnSortDirection(column: SortColumn): SortDirection | null {
    return this.sortDirectionFor(column, this.normalizeFilters(this.filters()).sortBy);
  }

  protected setPageSize(pageSize: number): void {
    this.filtersForm.patchValue({ pageSize });
  }

  protected previousPage(): void {
    if (this.currentPage() <= 0) {
      return;
    }

    this.currentPage.update((value) => value - 1);
  }

  protected nextPage(): void {
    if (this.currentPage() >= this.totalPages() - 1) {
      return;
    }

    this.currentPage.update((value) => value + 1);
  }

  private applyFilters(vacancies: Vacancy[], filters: VacancyFilters): Vacancy[] {
    const searchTerm = filters.search.trim().toLowerCase();
    const fromTimestamp = filters.fromDate ? Date.parse(filters.fromDate) : null;
    const toTimestamp = filters.toDate ? Date.parse(filters.toDate) : null;

    const filtered = vacancies.filter((vacancy) => {
      if (searchTerm) {
        const searchableText = [
          vacancy.company,
          vacancy.position,
          vacancy.domain,
          vacancy.headquarters,
          vacancy.contactName,
          vacancy.notes,
          ...vacancy.tags,
          ...vacancy.techStack
        ]
          .join(' ')
          .toLowerCase();

        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      if (filters.company !== 'all' && vacancy.company !== filters.company) {
        return false;
      }

      if (filters.status !== 'all' && vacancy.applicationStatus !== filters.status) {
        return false;
      }

      if (filters.modality !== 'all' && vacancy.modality !== filters.modality) {
        return false;
      }

      if (filters.priority !== 'all' && vacancy.priority !== filters.priority) {
        return false;
      }

      if (filters.stack !== 'all' && !vacancy.techStack.includes(filters.stack)) {
        return false;
      }

      if (filters.headquarters !== 'all' && vacancy.headquarters !== filters.headquarters) {
        return false;
      }

      if (fromTimestamp || toTimestamp) {
        const referenceDate = vacancy.applicationDate || vacancy.createdAt;
        const referenceTimestamp = Date.parse(referenceDate);

        if (Number.isNaN(referenceTimestamp)) {
          return false;
        }

        if (fromTimestamp && referenceTimestamp < fromTimestamp) {
          return false;
        }

        if (toTimestamp && referenceTimestamp > toTimestamp) {
          return false;
        }
      }

      return true;
    });

    if (filters.sortBy === 'default') {
      return filtered;
    }

    return filtered.sort((left, right) => this.compareVacancies(left, right, filters.sortBy));
  }

  private compareVacancies(left: Vacancy, right: Vacancy, sortBy: SortOption): number {
    const leftUpdated = Date.parse(left.lastUpdatedAt);
    const rightUpdated = Date.parse(right.lastUpdatedAt);
    const leftApplication = Date.parse(left.applicationDate || left.createdAt);
    const rightApplication = Date.parse(right.applicationDate || right.createdAt);
    const leftPriority = this.priorityRanking.get(left.priority) ?? 0;
    const rightPriority = this.priorityRanking.get(right.priority) ?? 0;

    switch (sortBy) {
      case 'updated_asc':
        return leftUpdated - rightUpdated;
      case 'updated_desc':
        return rightUpdated - leftUpdated;
      case 'company_asc':
        return left.company.localeCompare(right.company);
      case 'company_desc':
        return right.company.localeCompare(left.company);
      case 'position_asc':
        return left.position.localeCompare(right.position);
      case 'position_desc':
        return right.position.localeCompare(left.position);
      case 'status_asc':
        return left.applicationStatus.localeCompare(right.applicationStatus);
      case 'status_desc':
        return right.applicationStatus.localeCompare(left.applicationStatus);
      case 'modality_asc':
        return left.modality.localeCompare(right.modality);
      case 'modality_desc':
        return right.modality.localeCompare(left.modality);
      case 'application_asc':
        return leftApplication - rightApplication;
      case 'application_desc':
        return rightApplication - leftApplication;
      case 'priority_asc':
        return leftPriority - rightPriority;
      case 'priority_desc':
        return rightPriority - leftPriority;
      default:
        return rightUpdated - leftUpdated;
    }
  }

  private extractUniqueValues(values: string[]): string[] {
    return [...new Set(values.filter((item) => item.trim().length > 0))].sort((left, right) =>
      left.localeCompare(right)
    );
  }

  private normalizeFilters(rawFilters: Partial<VacancyFilters>): VacancyFilters {
    return {
      search: rawFilters.search ?? '',
      company: rawFilters.company ?? 'all',
      status: rawFilters.status ?? 'all',
      modality: rawFilters.modality ?? 'all',
      priority: rawFilters.priority ?? 'all',
      stack: rawFilters.stack ?? 'all',
      headquarters: rawFilters.headquarters ?? 'all',
      fromDate: rawFilters.fromDate ?? '',
      toDate: rawFilters.toDate ?? '',
      sortBy: rawFilters.sortBy ?? 'default',
      pageSize: rawFilters.pageSize ?? 8
    };
  }

  private resolveSortOption(column: SortColumn, direction: SortDirection): SortOption {
    switch (column) {
      case 'company':
        return direction === 'asc' ? 'company_asc' : 'company_desc';
      case 'position':
        return direction === 'asc' ? 'position_asc' : 'position_desc';
      case 'status':
        return direction === 'asc' ? 'status_asc' : 'status_desc';
      case 'modality':
        return direction === 'asc' ? 'modality_asc' : 'modality_desc';
      case 'application':
        return direction === 'asc' ? 'application_asc' : 'application_desc';
      case 'priority':
        return direction === 'asc' ? 'priority_asc' : 'priority_desc';
      case 'updated':
        return direction === 'asc' ? 'updated_asc' : 'updated_desc';
      default:
        return 'updated_desc';
    }
  }

  private sortDirectionFor(column: SortColumn, sortBy: SortOption): SortDirection | null {
    if (sortBy === 'default') {
      return null;
    }

    if (sortBy.startsWith(`${column}_`)) {
      return sortBy.endsWith('_asc') ? 'asc' : 'desc';
    }

    if (column === 'application' && sortBy.startsWith('application_')) {
      return sortBy.endsWith('_asc') ? 'asc' : 'desc';
    }

    if (column === 'updated' && sortBy.startsWith('updated_')) {
      return sortBy.endsWith('_asc') ? 'asc' : 'desc';
    }

    return null;
  }
}
