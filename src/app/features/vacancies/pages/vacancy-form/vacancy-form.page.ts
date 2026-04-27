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
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import {
  CompanyResponseState,
  EmploymentType,
  SeniorityLevel,
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
import { ConfirmationDialogComponent } from '../../../../shared/ui/confirmation-dialog/confirmation-dialog.component';
import { VacancyExcelImportService } from '../../services/vacancy-excel-import.service';
import { VacancyUrlImportService } from '../../services/vacancy-url-import.service';
import { VacancyService } from '../../services/vacancy.service';
import { UrlImportDialogComponent } from '../../../../shared/ui/url-import-dialog/url-import-dialog.component';

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
  private readonly vacancyUrlImportService = inject(VacancyUrlImportService);
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
  protected readonly employmentTypeOptions: EmploymentType[] = [
    'full_time',
    'part_time',
    'contract',
    'freelance',
    'internship',
    'temporary',
    'other'
  ];
  protected readonly seniorityOptions: SeniorityLevel[] = ['intern', 'junior', 'mid', 'senior', 'lead', 'manager', 'unknown'];
  protected readonly sourceTypeOptions: Vacancy['sourceType'][] = [
    'job_board',
    'recruiter',
    'referral',
    'company_site',
    'networking',
    'other'
  ];
  protected readonly companyResponseOptions: CompanyResponseState[] = [
    'none',
    'pending',
    'positive',
    'negative'
  ];

  protected readonly isSaving = signal(false);
  protected readonly isImporting = signal(false);
  protected readonly isImportingFromUrl = signal(false);
  protected readonly isEditMode = computed(() => Boolean(this.editingVacancy));

  protected readonly vacancyForm = this.formBuilder.nonNullable.group({
    company: ['', [Validators.required, Validators.minLength(2)]],
    position: ['', [Validators.required, Validators.minLength(2)]],
    domain: [''],
    location: [''],
    headquarters: [''],
    modality: this.formBuilder.nonNullable.control<WorkModality>('remote', Validators.required),
    employmentType: this.formBuilder.nonNullable.control<EmploymentType>('full_time', Validators.required),
    seniority: this.formBuilder.nonNullable.control<SeniorityLevel>('unknown', Validators.required),
    techStack: [''],
    salary: [''],
    salaryMin: [''],
    salaryMax: [''],
    salaryCurrency: [''],
    offerSource: [''],
    sourceType: this.formBuilder.nonNullable.control<Vacancy['sourceType']>('job_board', Validators.required),
    offerUrl: [''],
    companyUrl: [''],
    contactName: [''],
    contactEmail: [''],
    contactLinkedin: [''],
    contactDate: [''],
    discoveredAt: [''],
    applicationDate: [''],
    lastStatusChangeAt: [''],
    status: this.formBuilder.nonNullable.control<VacancyStatus>('pending', Validators.required),
    processStage: ['Applied'],
    priority: this.formBuilder.nonNullable.control<VacancyPriority>('medium', Validators.required),
    responseState: this.formBuilder.nonNullable.control<CompanyResponseState>('none', Validators.required),
    followUpPending: this.formBuilder.nonNullable.control(false),
    favorite: this.formBuilder.nonNullable.control(false),
    archived: this.formBuilder.nonNullable.control(false),
    nextFollowUpDate: [''],
    rejectionReason: [''],
    closureReason: [''],
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
      const beforeVacanciesCount = this.vacancyService.getAll().length;
      const beforeEventsCount = this.vacancyService.getEvents().length;
      const beforeFollowUpsCount = this.vacancyService.getFollowUps().length;
      const importResult = await this.vacancyExcelImportService.importFromFile(file);

      if (importResult.mode === 'snapshot') {
        this.vacancyService.importSnapshot({
          vacancies: importResult.vacancies,
          events: importResult.events,
          followUps: importResult.followUps
        });
      } else {
        for (const vacancy of importResult.vacancies) {
          this.vacancyService.create(vacancy);
        }
      }

      const afterVacanciesCount = this.vacancyService.getAll().length;
      const afterEventsCount = this.vacancyService.getEvents().length;
      const afterFollowUpsCount = this.vacancyService.getFollowUps().length;

      const addedVacancies = Math.max(0, afterVacanciesCount - beforeVacanciesCount);
      const addedEvents = Math.max(0, afterEventsCount - beforeEventsCount);
      const addedFollowUps = Math.max(0, afterFollowUpsCount - beforeFollowUpsCount);
      const skippedExistingVacancies = Math.max(0, importResult.vacancies.length - addedVacancies);
      const skippedExistingEvents = Math.max(0, importResult.events.length - addedEvents);
      const skippedExistingFollowUps = Math.max(0, importResult.followUps.length - addedFollowUps);

      this.dialog.open(ConfirmationDialogComponent, {
        maxWidth: '520px',
        data: {
          variant: 'info',
          title: this.i18nService.translate('vacancies.importDialog.title'),
          message: this.i18nService.translate('vacancies.form.importSuccess', {
            count: importResult.vacancies.length,
            skipped: importResult.skippedRows
          }),
          details: [
            this.i18nService.translate(
              importResult.mode === 'snapshot'
                ? 'vacancies.importDialog.modeSnapshot'
                : 'vacancies.importDialog.modeVacanciesOnly'
            ),
            this.i18nService.translate('vacancies.importDialog.vacancies', { count: importResult.vacancies.length }),
            this.i18nService.translate('vacancies.importDialog.vacanciesAdded', { count: addedVacancies }),
            this.i18nService.translate('vacancies.importDialog.vacanciesSkippedExisting', {
              count: skippedExistingVacancies
            }),
            this.i18nService.translate('vacancies.importDialog.events', { count: importResult.events.length }),
            this.i18nService.translate('vacancies.importDialog.eventsAdded', { count: addedEvents }),
            this.i18nService.translate('vacancies.importDialog.eventsSkippedExisting', { count: skippedExistingEvents }),
            this.i18nService.translate('vacancies.importDialog.followUps', { count: importResult.followUps.length }),
            this.i18nService.translate('vacancies.importDialog.followUpsAdded', { count: addedFollowUps }),
            this.i18nService.translate('vacancies.importDialog.followUpsSkippedExisting', {
              count: skippedExistingFollowUps
            }),
            this.i18nService.translate('vacancies.importDialog.skipped', { count: importResult.skippedRows })
          ]
        }
      });

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
    const techStack = formValue.techStack
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    const discoveredAtIso = this.toIsoDateTime(formValue.discoveredAt);
    const contactDateIso = this.toIsoDateTime(formValue.contactDate);
    const applicationDateIso = this.toIsoDateTime(formValue.applicationDate);
    const lastStatusChangeAtIso = this.toIsoDateTime(formValue.lastStatusChangeAt);
    const nextFollowUpDateIso = this.toIsoDateTime(formValue.nextFollowUpDate);

    if (this.editingVacancy) {
      this.vacancyService.update(this.editingVacancy.id, {
        company: formValue.company,
        position: formValue.position,
        domain: formValue.domain || null,
        location: formValue.location || null,
        headquarters: formValue.headquarters || null,
        modality: formValue.modality,
        employmentType: formValue.employmentType,
        seniority: formValue.seniority,
        techStack,
        salaryText: formValue.salary || null,
        salaryMin: this.toNullableNumber(formValue.salaryMin),
        salaryMax: this.toNullableNumber(formValue.salaryMax),
        salaryCurrency: formValue.salaryCurrency || null,
        offerSource: formValue.offerSource || null,
        sourceType: formValue.sourceType,
        offerUrl: formValue.offerUrl || null,
        companyUrl: formValue.companyUrl || null,
        contactName: formValue.contactName || null,
        contactEmail: formValue.contactEmail || null,
        contactLinkedin: formValue.contactLinkedin || null,
        lastContactAt: contactDateIso,
        discoveredAt: discoveredAtIso,
        applicationDate: applicationDateIso,
        lastStatusChangeAt: lastStatusChangeAtIso,
        applicationStatus: formValue.status,
        processStage: formValue.processStage || null,
        priority: formValue.priority,
        companyResponse: formValue.responseState,
        followUpPending: formValue.followUpPending,
        favorite: formValue.favorite,
        archived: formValue.archived,
        nextFollowUpDate: nextFollowUpDateIso,
        rejectionReason: formValue.rejectionReason || null,
        closureReason: formValue.closureReason || null,
        notes: formValue.notes || null,
        hrObservations: formValue.hrObservations || null,
        tags,
        updatedAt: now,
        closedAt:
          (formValue.status === 'rejected' || formValue.status === 'hired') &&
          !this.editingVacancy.closedAt
            ? now
            : this.editingVacancy.closedAt,
        archivedAt: formValue.archived ? this.editingVacancy.archivedAt ?? now : null
      });

      void this.router.navigate(['/app/vacancies', this.editingVacancy.id]);
      return;
    }

    const newVacancy: Vacancy = {
      id: crypto.randomUUID(),
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: formValue.archived ? now : null,
      closedAt: formValue.status === 'rejected' || formValue.status === 'hired' ? now : null,
      company: formValue.company,
      position: formValue.position,
      domain: formValue.domain || null,
      location: formValue.location || null,
      headquarters: formValue.headquarters || null,
      modality: formValue.modality,
      employmentType: formValue.employmentType,
      seniority: formValue.seniority,
      techStack,
      salaryText: formValue.salary || null,
      salaryMin: this.toNullableNumber(formValue.salaryMin),
      salaryMax: this.toNullableNumber(formValue.salaryMax),
      salaryCurrency: formValue.salaryCurrency || null,
      offerSource: formValue.offerSource || null,
      sourceType: formValue.sourceType,
      offerUrl: formValue.offerUrl || null,
      companyUrl: formValue.companyUrl || null,
      contactName: formValue.contactName || null,
      contactEmail: formValue.contactEmail || null,
      contactLinkedin: formValue.contactLinkedin || null,
      lastContactAt: contactDateIso,
      applicationStatus: formValue.status,
      processStage: formValue.processStage || null,
      priority: formValue.priority,
      companyResponse: formValue.responseState,
      discoveredAt: discoveredAtIso ?? now,
      applicationDate: applicationDateIso,
      lastStatusChangeAt: lastStatusChangeAtIso ?? now,
      nextFollowUpDate: nextFollowUpDateIso,
      followUpPending: formValue.followUpPending,
      favorite: formValue.favorite,
      archived: formValue.archived,
      rejectionReason: formValue.rejectionReason || null,
      closureReason: formValue.closureReason || null,
      notes: formValue.notes || null,
      hrObservations: formValue.hrObservations || null,
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
      domain: vacancy.domain ?? '',
      location: vacancy.location ?? '',
      headquarters: vacancy.headquarters ?? '',
      modality: vacancy.modality,
      employmentType: vacancy.employmentType,
      seniority: vacancy.seniority,
      techStack: vacancy.techStack.join(', '),
      salary: vacancy.salaryText ?? '',
      salaryMin: vacancy.salaryMin !== null ? `${vacancy.salaryMin}` : '',
      salaryMax: vacancy.salaryMax !== null ? `${vacancy.salaryMax}` : '',
      salaryCurrency: vacancy.salaryCurrency ?? '',
      offerSource: vacancy.offerSource ?? '',
      sourceType: vacancy.sourceType,
      offerUrl: vacancy.offerUrl ?? '',
      companyUrl: vacancy.companyUrl ?? '',
      contactName: vacancy.contactName ?? '',
      contactEmail: vacancy.contactEmail ?? '',
      contactLinkedin: vacancy.contactLinkedin ?? '',
      contactDate: this.toLocalDateTimeInput(vacancy.lastContactAt),
      discoveredAt: this.toLocalDateTimeInput(vacancy.discoveredAt),
      applicationDate: this.toLocalDateTimeInput(vacancy.applicationDate),
      lastStatusChangeAt: this.toLocalDateTimeInput(vacancy.lastStatusChangeAt),
      status: vacancy.applicationStatus,
      processStage: vacancy.processStage ?? '',
      priority: vacancy.priority,
      responseState: vacancy.companyResponse,
      followUpPending: vacancy.followUpPending,
      favorite: vacancy.favorite,
      archived: vacancy.archived,
      nextFollowUpDate: this.toLocalDateTimeInput(vacancy.nextFollowUpDate),
      rejectionReason: vacancy.rejectionReason ?? '',
      closureReason: vacancy.closureReason ?? '',
      notes: vacancy.notes ?? '',
      hrObservations: vacancy.hrObservations ?? '',
      tags: vacancy.tags.join(', ')
    });
  }

  protected async openUrlImport(): Promise<void> {
    if (this.shouldBlockDemoActions()) {
      return;
    }

    const dialogRef = this.dialog.open(UrlImportDialogComponent, {
      maxWidth: '520px',
      width: '100%',
      data: {
        titleKey: 'vacancies.urlImport.dialogTitle',
        messageKey: 'vacancies.urlImport.dialogMessage',
        placeholderKey: 'vacancies.urlImport.urlPlaceholder',
        confirmKey: 'vacancies.urlImport.analyze'
      }
    });

    const inputUrl = await firstValueFrom(dialogRef.afterClosed());
    if (!inputUrl || typeof inputUrl !== 'string') {
      return;
    }

    this.isImportingFromUrl.set(true);

    try {
      const imported = await this.vacancyUrlImportService.importFromUrl(inputUrl);
      const details = [
        `${this.i18nService.translate('vacancies.form.company')}: ${imported.vacancy.company}`,
        `${this.i18nService.translate('vacancies.form.position')}: ${imported.vacancy.position}`,
        `${this.i18nService.translate('vacancies.form.domain')}: ${imported.vacancy.domain ?? this.i18nService.translate('common.notAvailable')}`,
        `${this.i18nService.translate('vacancies.form.modality')}: ${this.modalityLabel(imported.vacancy.modality)}`,
        `${this.i18nService.translate('vacancies.form.offerSource')}: ${imported.sourceLabel}`,
        `${this.i18nService.translate('vacancies.form.offerUrl')}: ${imported.vacancy.offerUrl ?? this.i18nService.translate('common.notAvailable')}`
      ];

      const previewDialogRef = this.dialog.open(ConfirmationDialogComponent, {
        maxWidth: '560px',
        data: {
          title: this.i18nService.translate('vacancies.urlImport.previewTitle'),
          message: this.i18nService.translate('vacancies.urlImport.previewMessage'),
          details,
          variant: 'confirm',
          cancelLabelKey: 'common.cancel',
          confirmLabelKey: 'vacancies.urlImport.insert'
        }
      });

      const confirmed = Boolean(await firstValueFrom(previewDialogRef.afterClosed()));
      if (!confirmed) {
        return;
      }

      this.vacancyService.create(imported.vacancy);
      this.dialog.open(ConfirmationDialogComponent, {
        maxWidth: '520px',
        data: {
          variant: 'info',
          title: this.i18nService.translate('vacancies.urlImport.insertedTitle'),
          message: this.i18nService.translate('vacancies.urlImport.insertedMessage'),
          details
        }
      });
      void this.router.navigate(['/app/vacancies', imported.vacancy.id]);
    } catch (error) {
      if (error instanceof Error && error.message === 'UNSUPPORTED_SOURCE') {
        this.dialog.open(ConfirmationDialogComponent, {
          maxWidth: '520px',
          data: {
            variant: 'info',
            title: this.i18nService.translate('vacancies.urlImport.unsupportedTitle'),
            message: this.i18nService.translate('vacancies.urlImport.unsupportedMessage')
          }
        });
        return;
      }

      this.snackBar.open(
        this.i18nService.translate('vacancies.urlImport.failed'),
        this.i18nService.translate('common.close'),
        { duration: 4500 }
      );
    } finally {
      this.isImportingFromUrl.set(false);
    }
  }

  private toIsoDateTime(value: string): string | null {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    const parsedDate = new Date(trimmedValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate.toISOString();
  }

  private toLocalDateTimeInput(value: string | null): string {
    if (!value) {
      return '';
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return '';
    }

    const localDate = new Date(parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  private toNullableNumber(value: string): number | null {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return null;
    }

    const parsed = Number(trimmedValue.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
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
