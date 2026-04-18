import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import {
  CompanyResponseState,
  Vacancy,
  VacancyPriority,
  VacancyStatus,
  WorkModality
} from '../../../../core/models/vacancy.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import {
  modalityToTranslationKey,
  priorityToTranslationKey,
  responseToTranslationKey,
  statusToTranslationKey
} from '../../../../shared/utils/label-mappers';
import { DemoRestrictionDialogComponent } from '../../../../shared/ui/demo-restriction-dialog/demo-restriction-dialog.component';
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
    MatDialogModule,
    MatSnackBarModule,
    TranslatePipe
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
  private readonly dialog = inject(MatDialog);
  private readonly i18nService = inject(I18nService);
  private readonly authService = inject(AuthService);
  private readonly vacancyExcelImportService = inject(VacancyExcelImportService);
  private readonly vacancyService = inject(VacancyService);

  private readonly editingVacancyId = this.route.snapshot.paramMap.get('id');
  private readonly editingVacancy = this.editingVacancyId
    ? this.vacancyService.getById(this.editingVacancyId)
    : undefined;

  protected readonly statusOptions: VacancyStatus[] = [
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
      return;
    }

    if (this.authService.isDemoSession()) {
      this.openDemoRestrictionDialog();
    }
  }

  protected openExcelImport(): void {
    if (this.shouldBlockDemoActions()) {
      return;
    }

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
        this.i18nService.translate('vacancies.form.importSuccess', {
          count: importResult.vacancies.length,
          skipped: importResult.skippedRows
        }),
        this.i18nService.translate('common.close'),
        { duration: 4500 }
      );

      if (importResult.vacancies.length > 0) {
        void this.router.navigate(['/app/vacancies']);
      }
    } catch {
      this.snackBar.open(this.i18nService.translate('vacancies.form.importFailed'), this.i18nService.translate('common.close'), {
        duration: 4500
      });
    } finally {
      this.isImporting.set(false);
      input.value = '';
    }
  }

  protected save(): void {
    if (this.shouldBlockDemoActions()) {
      return;
    }

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
        salaryText: formValue.salary,
        offerSource: formValue.offerSource,
        offerUrl: formValue.offerUrl,
        companyUrl: formValue.companyUrl,
        contactName: formValue.contactName,
        lastContactAt: formValue.contactDate || null,
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
        updatedAt: now,
        lastStatusChangeAt: now,
        closedAt: formValue.status === 'rejected' || formValue.status === 'hired' ? now : null,
        closureReason: formValue.status === 'rejected' ? 'rejected' : '',
        archivedAt: null
      });

      void this.router.navigate(['/app/vacancies', this.editingVacancy.id]);
      return;
    }

    const newVacancy: Vacancy = {
      id: crypto.randomUUID(),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      closedAt: null,
      company: formValue.company,
      position: formValue.position,
      domain: formValue.domain,
      location: formValue.headquarters,
      headquarters: formValue.headquarters,
      modality: formValue.modality,
      employmentType: 'full_time',
      seniority: 'unknown',
      techStack: tags,
      salaryText: formValue.salary,
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      offerSource: formValue.offerSource,
      sourceType: 'job_board',
      offerUrl: formValue.offerUrl,
      companyUrl: formValue.companyUrl,
      contactName: formValue.contactName,
      contactEmail: '',
      contactLinkedin: '',
      lastContactAt: formValue.contactDate || null,
      applicationStatus: formValue.status,
      processStage: formValue.processStage,
      priority: formValue.priority,
      companyResponse: formValue.responseState,
      discoveredAt: now,
      applicationDate: formValue.applicationDate || null,
      lastStatusChangeAt: now,
      nextFollowUpDate: formValue.nextFollowUpDate || null,
      followUpPending: formValue.followUpPending,
      favorite: false,
      archived: false,
      rejectionReason: '',
      closureReason: '',
      notes: formValue.notes,
      hrObservations: formValue.hrObservations,
      tags
    };

    this.vacancyService.create(newVacancy);
    void this.router.navigate(['/app/vacancies', newVacancy.id]);
  }

  protected statusLabel(status: VacancyStatus): string {
    return this.i18nService.translate(statusToTranslationKey(status));
  }

  protected priorityLabel(priority: VacancyPriority): string {
    return this.i18nService.translate(priorityToTranslationKey(priority));
  }

  protected modalityLabel(modality: WorkModality): string {
    return this.i18nService.translate(modalityToTranslationKey(modality));
  }

  protected responseLabel(response: CompanyResponseState): string {
    return this.i18nService.translate(responseToTranslationKey(response));
  }

  private patchForm(vacancy: Vacancy): void {
    this.vacancyForm.patchValue({
      company: vacancy.company,
      position: vacancy.position,
      domain: vacancy.domain,
      headquarters: vacancy.headquarters,
      modality: vacancy.modality,
      salary: vacancy.salaryText,
      offerSource: vacancy.offerSource,
      offerUrl: vacancy.offerUrl,
      companyUrl: vacancy.companyUrl,
      contactName: vacancy.contactName,
      contactDate: vacancy.lastContactAt ?? '',
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

  private shouldBlockDemoActions(): boolean {
    if (!this.authService.isDemoSession()) {
      return false;
    }

    this.openDemoRestrictionDialog();
    return true;
  }

  private openDemoRestrictionDialog(): void {
    const dialogRef = this.dialog.open(DemoRestrictionDialogComponent, {
      maxWidth: '460px',
      data: {
        titleKey: 'vacancies.demoRestriction.title',
        messageKey: 'vacancies.demoRestriction.message'
      }
    });

    dialogRef.afterClosed().subscribe((shouldRegister: boolean) => {
      if (!shouldRegister) {
        return;
      }

      this.authService.logout();
      void this.router.navigate(['/auth/register']);
    });
  }
}
