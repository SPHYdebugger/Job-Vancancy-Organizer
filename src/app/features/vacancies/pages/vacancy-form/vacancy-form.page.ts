import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  CompanyResponseState,
  Vacancy,
  VacancyPriority,
  VacancyStatus,
  WorkModality
} from '../../../../core/models/vacancy.model';
import { VacancyExcelImportService } from '../../services/vacancy-excel-import.service';
import { VacancyService } from '../../services/vacancy.service';

@Component({
  selector: 'app-vacancy-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './vacancy-form.page.html',
  styleUrl: './vacancy-form.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacancyFormPageComponent {
  @ViewChild('excelFileInput') private readonly excelFileInput?: ElementRef<HTMLInputElement>;

  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly vacancyExcelImportService = inject(VacancyExcelImportService);
  private readonly vacancyService = inject(VacancyService);

  private readonly editingVacancyId = this.route.snapshot.paramMap.get('id');
  private readonly editingVacancy = this.editingVacancyId
    ? this.vacancyService.getById(this.editingVacancyId)
    : undefined;

  protected readonly statusOptions: VacancyStatus[] = [
    'pending',
    'cv_sent',
    'applied',
    'in_review',
    'hr_contact',
    'interview',
    'technical_test',
    'finalist',
    'rejected',
    'no_response',
    'hired'
  ];
  protected readonly priorityOptions: VacancyPriority[] = ['low', 'medium', 'high'];
  protected readonly modalityOptions: WorkModality[] = ['remote', 'hybrid', 'on_site'];
  protected readonly companyResponseOptions: CompanyResponseState[] = [
    'none',
    'pending',
    'positive',
    'negative'
  ];

  protected readonly isSaving = signal(false);
  protected readonly isImporting = signal(false);
  protected readonly isEditMode = computed(() => Boolean(this.editingVacancy));

  protected readonly vacancyForm = this.formBuilder.nonNullable.group({
    company: ['', [Validators.required, Validators.minLength(2)]],
    position: ['', [Validators.required, Validators.minLength(2)]],
    domain: ['', Validators.required],
    headquarters: ['', Validators.required],
    modality: this.formBuilder.nonNullable.control<WorkModality>('remote', Validators.required),
    salary: [''],
    offerSource: ['LinkedIn', Validators.required],
    offerUrl: [''],
    companyUrl: [''],
    contactName: [''],
    contactDate: [''],
    applicationDate: [''],
    status: this.formBuilder.nonNullable.control<VacancyStatus>('pending', Validators.required),
    processStage: ['Applied'],
    priority: this.formBuilder.nonNullable.control<VacancyPriority>('medium', Validators.required),
    responseState: this.formBuilder.nonNullable.control<CompanyResponseState>('none', Validators.required),
    followUpPending: this.formBuilder.nonNullable.control(false),
    nextFollowUpDate: [''],
    notes: [''],
    hrObservations: [''],
    tags: ['']
  });

  constructor() {
    if (this.editingVacancy) {
      this.patchForm(this.editingVacancy);
    }
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

      if (importResult.vacancies.length > 0) {
        void this.router.navigate(['/app/vacancies']);
      }
    } catch {
      this.snackBar.open('Excel import failed. Please verify the file format.', 'Close', {
        duration: 4500
      });
    } finally {
      this.isImporting.set(false);
      input.value = '';
    }
  }

  protected save(): void {
    if (this.vacancyForm.invalid) {
      this.vacancyForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);

    const formValue = this.vacancyForm.getRawValue();
    const now = new Date().toISOString();
    const tags = formValue.tags
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (this.editingVacancy) {
      this.vacancyService.update(this.editingVacancy.id, {
        company: formValue.company,
        position: formValue.position,
        domain: formValue.domain,
        headquarters: formValue.headquarters,
        modality: formValue.modality,
        salary: formValue.salary,
        offerSource: formValue.offerSource,
        offerUrl: formValue.offerUrl,
        companyUrl: formValue.companyUrl,
        contactName: formValue.contactName,
        contactDate: formValue.contactDate || null,
        applicationDate: formValue.applicationDate || null,
        applicationStatus: formValue.status,
        processStage: formValue.processStage,
        priority: formValue.priority,
        companyResponse: formValue.responseState,
        followUpPending: formValue.followUpPending,
        nextFollowUpDate: formValue.nextFollowUpDate || null,
        notes: formValue.notes,
        hrObservations: formValue.hrObservations,
        tags,
        lastUpdatedAt: now,
        rejected: formValue.status === 'rejected',
        responseReceived: formValue.responseState === 'positive' || formValue.responseState === 'negative'
      });

      void this.router.navigate(['/app/vacancies', this.editingVacancy.id]);
      return;
    }

    const newVacancy: Vacancy = {
      id: crypto.randomUUID(),
      createdAt: now,
      company: formValue.company,
      position: formValue.position,
      domain: formValue.domain,
      headquarters: formValue.headquarters,
      modality: formValue.modality,
      techStack: tags,
      salary: formValue.salary,
      offerSource: formValue.offerSource,
      offerUrl: formValue.offerUrl,
      companyUrl: formValue.companyUrl,
      contactName: formValue.contactName,
      contactDate: formValue.contactDate || null,
      message: '',
      cvSent: formValue.status !== 'pending',
      responseReceived: formValue.responseState === 'positive' || formValue.responseState === 'negative',
      applicationStatus: formValue.status,
      processStage: formValue.processStage,
      priority: formValue.priority,
      applicationDate: formValue.applicationDate || null,
      lastUpdatedAt: now,
      interviewCompleted: false,
      technicalInterview: formValue.status === 'technical_test',
      companyResponse: formValue.responseState,
      rejected: formValue.status === 'rejected',
      rejectionReason: '',
      followUpPending: formValue.followUpPending,
      nextFollowUpDate: formValue.nextFollowUpDate || null,
      notes: formValue.notes,
      hrObservations: formValue.hrObservations,
      tags
    };

    this.vacancyService.create(newVacancy);
    void this.router.navigate(['/app/vacancies', newVacancy.id]);
  }

  private patchForm(vacancy: Vacancy): void {
    this.vacancyForm.patchValue({
      company: vacancy.company,
      position: vacancy.position,
      domain: vacancy.domain,
      headquarters: vacancy.headquarters,
      modality: vacancy.modality,
      salary: vacancy.salary,
      offerSource: vacancy.offerSource,
      offerUrl: vacancy.offerUrl,
      companyUrl: vacancy.companyUrl,
      contactName: vacancy.contactName,
      contactDate: vacancy.contactDate ?? '',
      applicationDate: vacancy.applicationDate ?? '',
      status: vacancy.applicationStatus,
      processStage: vacancy.processStage,
      priority: vacancy.priority,
      responseState: vacancy.companyResponse,
      followUpPending: vacancy.followUpPending,
      nextFollowUpDate: vacancy.nextFollowUpDate ?? '',
      notes: vacancy.notes,
      hrObservations: vacancy.hrObservations,
      tags: vacancy.tags.join(', ')
    });
  }
}
