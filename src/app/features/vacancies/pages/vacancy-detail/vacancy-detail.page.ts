import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { VacancyEvent } from '../../../../core/models/vacancy-event.model';
import { VacancyPriority, VacancyStatus, WorkModality } from '../../../../core/models/vacancy.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { ConfirmationDialogComponent } from '../../../../shared/ui/confirmation-dialog/confirmation-dialog.component';
import { modalityToTranslationKey, priorityToTranslationKey, statusToTranslationKey } from '../../../../shared/utils/label-mappers';
import { RecordVacancyEventInput, VacancyService } from '../../services/vacancy.service';

type EventComposerType =
  | 'applied'
  | 'response_received'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'follow_up_scheduled'
  | 'follow_up_sent'
  | 'note_added'
  | 'technical_test_sent'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

@Component({
  selector: 'app-vacancy-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    TranslatePipe
  ],
  templateUrl: './vacancy-detail.page.html',
  styleUrl: './vacancy-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacancyDetailPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18nService = inject(I18nService);
  private readonly vacancyService = inject(VacancyService);

  private readonly vacancyId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly vacancy = computed(() => this.vacancyService.getById(this.vacancyId));
  protected readonly vacancyEvents = toSignal(this.vacancyService.watchEvents(this.vacancyId), { initialValue: [] as VacancyEvent[] });
  protected readonly orderedEvents = computed(() =>
    [...this.vacancyEvents()].sort((left, right) => {
      const byEventDate = new Date(right.eventAt).getTime() - new Date(left.eventAt).getTime();
      if (byEventDate !== 0) {
        return byEventDate;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
  );
  protected readonly latestEvent = computed(() => this.orderedEvents()[0] ?? null);
  protected readonly locale = this.i18nService.locale;
  protected readonly eventTypeOptions: EventComposerType[] = [
    'applied',
    'response_received',
    'interview_scheduled',
    'interview_completed',
    'follow_up_scheduled',
    'follow_up_sent',
    'note_added',
    'technical_test_sent',
    'hired',
    'rejected',
    'withdrawn'
  ];
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
  protected readonly isSavingEvent = signal(false);
  protected readonly isEventComposerExpanded = signal(false);
  protected readonly lastCalendarUrl = signal<string | null>(null);
  protected readonly expandedEventId = signal<string | null>(null);
  protected readonly editingEventId = signal<string | null>(null);
  protected readonly eventForm = this.formBuilder.nonNullable.group({
    type: this.formBuilder.nonNullable.control<EventComposerType>('applied', Validators.required),
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', Validators.required],
    eventAt: [''],
    statusAfter: this.formBuilder.control<VacancyStatus | ''>(''),
    processStage: [''],
    companyResponse: this.formBuilder.control<'none' | 'pending' | 'positive' | 'negative' | ''>(''),
    contactName: [''],
    contactChannel: this.formBuilder.control<'email' | 'linkedin' | 'phone' | 'whatsapp' | 'other' | ''>(''),
    interviewType: this.formBuilder.control<'hr' | 'technical' | 'final' | 'other' | ''>(''),
    interviewDate: [''],
    interviewResult: this.formBuilder.control<'pending' | 'passed' | 'failed' | 'unknown' | ''>(''),
    interviewEvaluatedSkills: [''],
    interviewHighlights: [''],
    interviewNotes: [''],
    followUpDate: [''],
    followUpSubject: [''],
    followUpMessage: [''],
    cvFileName: [''],
    coverLetterFileName: [''],
    recommendationFileName: [''],
    presentationText: [''],
    rejectionReason: ['']
  });
  protected readonly eventEditForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    description: ['', Validators.required],
    eventAt: ['', Validators.required]
  });

  protected readonly selectedEventType = toSignal(this.eventForm.controls.type.valueChanges, {
    initialValue: this.eventForm.controls.type.value
  });

  constructor() {
    this.applyEventTemplate(this.eventForm.controls.type.value);
    this.eventForm.controls.type.valueChanges.subscribe((type) => {
      this.applyEventTemplate(type);
    });
  }

  protected async deleteVacancy(): Promise<void> {
    const currentVacancy = this.vacancy();

    if (!currentVacancy) {
      return;
    }

    const shouldDelete = await this.confirmAction(
      this.i18nService.translate('vacancies.detail.deleteConfirm', {
        company: currentVacancy.company,
        position: currentVacancy.position
      })
    );

    if (!shouldDelete) {
      return;
    }

    this.vacancyService.remove(currentVacancy.id);
    void this.router.navigate(['/app/vacancies']);
  }

  protected saveEvent(): void {
    const currentVacancy = this.vacancy();
    if (!currentVacancy) {
      return;
    }

    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      return;
    }

    const formValue = this.eventForm.getRawValue();
    this.isSavingEvent.set(true);

    const recordInput: RecordVacancyEventInput = {
      type: formValue.type,
      title: formValue.title,
      description: formValue.description,
      eventAt: formValue.eventAt ? new Date(formValue.eventAt).toISOString() : undefined,
      statusAfter: formValue.statusAfter || undefined,
      processStage: formValue.processStage || undefined,
      companyResponse:
        formValue.companyResponse === ''
          ? undefined
          : (formValue.companyResponse as RecordVacancyEventInput['companyResponse']),
      contactName: formValue.contactName || undefined,
      contactChannel:
        formValue.contactChannel === ''
          ? undefined
          : (formValue.contactChannel as RecordVacancyEventInput['contactChannel']),
      interviewType:
        formValue.interviewType === ''
          ? undefined
          : (formValue.interviewType as RecordVacancyEventInput['interviewType']),
      interviewDate: formValue.interviewDate || undefined,
      interviewResult:
        formValue.interviewResult === ''
          ? undefined
          : (formValue.interviewResult as RecordVacancyEventInput['interviewResult']),
      interviewEvaluatedSkills: formValue.interviewEvaluatedSkills || undefined,
      interviewHighlights: formValue.interviewHighlights || undefined,
      interviewNotes: formValue.interviewNotes || undefined,
      followUpDate: formValue.followUpDate || undefined,
      followUpSubject: formValue.followUpSubject || undefined,
      followUpMessage: formValue.followUpMessage || undefined,
      cvFileName: formValue.cvFileName || undefined,
      coverLetterFileName: formValue.coverLetterFileName || undefined,
      recommendationFileName: formValue.recommendationFileName || undefined,
      presentationText: formValue.presentationText || undefined,
      rejectionReason: formValue.rejectionReason || undefined
    };

    const result = this.vacancyService.recordProcessEvent(currentVacancy.id, recordInput);
    this.lastCalendarUrl.set(result.calendarUrl);
    this.snackBar.open(this.i18nService.translate('vacancies.events.saved'), this.i18nService.translate('common.close'), {
      duration: 2800
    });
    this.isSavingEvent.set(false);
    this.applyEventTemplate(formValue.type);
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

  protected eventTypeLabel(eventType: VacancyEvent['type'] | EventComposerType): string {
    return this.i18nService.translate(`vacancies.events.type.${eventType}`);
  }

  protected eventCreatedAt(event: VacancyEvent): string | null {
    const fallbackDate = event.createdAt || event.eventAt;
    if (!fallbackDate) {
      return null;
    }

    const parsedDate = new Date(fallbackDate);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate.toISOString();
  }

  protected formatEventDateTime(dateValue: string | null | undefined): string {
    if (!dateValue) {
      return this.i18nService.translate('common.notAvailable');
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return this.i18nService.translate('common.notAvailable');
    }

    return new Intl.DateTimeFormat(this.locale(), {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(parsedDate);
  }

  protected formatCompactDateTime(dateValue: string | null | undefined): string {
    if (!dateValue) {
      return this.i18nService.translate('common.notAvailable');
    }

    const parsedDate = new Date(dateValue);
    if (Number.isNaN(parsedDate.getTime())) {
      return this.i18nService.translate('common.notAvailable');
    }

    const year = parsedDate.getFullYear();
    const month = `${parsedDate.getMonth() + 1}`.padStart(2, '0');
    const day = `${parsedDate.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected lastUpdatedSummary(): string {
    const latest = this.latestEvent();
    if (!latest) {
      return this.i18nService.translate('common.notAvailable');
    }

    return `${this.eventTypeLabel(latest.type)} · ${this.formatCompactDateTime(latest.eventAt)}`;
  }

  protected eventStatusTransition(event: VacancyEvent): string | null {
    if (!event.previousStatus || !event.newStatus || event.previousStatus === event.newStatus) {
      return null;
    }

    return this.i18nService.translate('vacancies.timeline.transition', {
      from: this.statusLabel(event.previousStatus),
      to: this.statusLabel(event.newStatus)
    });
  }

  protected toggleEventComposer(): void {
    this.isEventComposerExpanded.update((value) => !value);
  }

  protected toggleEventView(eventId: string): void {
    this.expandedEventId.set(this.expandedEventId() === eventId ? null : eventId);
  }

  protected startEditEvent(event: VacancyEvent): void {
    const dateLocal = new Date(new Date(event.eventAt).getTime() - new Date(event.eventAt).getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    this.editingEventId.set(event.id);
    this.expandedEventId.set(event.id);
    this.eventEditForm.patchValue({
      title: event.title,
      description: event.description,
      eventAt: dateLocal
    });
  }

  protected cancelEditEvent(): void {
    this.editingEventId.set(null);
    this.eventEditForm.reset();
  }

  protected saveEventEdit(eventId: string): void {
    if (this.eventEditForm.invalid) {
      this.eventEditForm.markAllAsTouched();
      return;
    }

    const formValue = this.eventEditForm.getRawValue();
    this.vacancyService.updateEvent(eventId, {
      title: formValue.title,
      description: formValue.description,
      eventAt: new Date(formValue.eventAt).toISOString()
    });
    this.snackBar.open(this.i18nService.translate('vacancies.events.updated'), this.i18nService.translate('common.close'), {
      duration: 2200
    });
    this.editingEventId.set(null);
  }

  protected async deleteEvent(event: VacancyEvent): Promise<void> {
    const shouldDelete = await this.confirmAction(
      this.i18nService.translate('vacancies.events.deleteConfirm', {
        title: event.title
      })
    );

    if (!shouldDelete) {
      return;
    }

    this.vacancyService.removeEvent(event.id);
    if (this.expandedEventId() === event.id) {
      this.expandedEventId.set(null);
    }
    if (this.editingEventId() === event.id) {
      this.editingEventId.set(null);
    }
    this.snackBar.open(this.i18nService.translate('vacancies.events.deleted'), this.i18nService.translate('common.close'), {
      duration: 2200
    });
  }

  private async confirmAction(message: string): Promise<boolean> {
    const dialogRef = this.dialog.open(ConfirmationDialogComponent, {
      maxWidth: '460px',
      data: {
        title: this.i18nService.translate('vacancies.deleteDialog.title'),
        message,
        warningMessage: this.i18nService.translate('vacancies.deleteDialog.irreversibleWarning'),
        cancelLabelKey: 'common.cancel',
        confirmLabelKey: 'common.delete'
      }
    });

    return Boolean(await firstValueFrom(dialogRef.afterClosed()));
  }

  private applyEventTemplate(eventType: EventComposerType): void {
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const templateMap: Record<EventComposerType, { title: string; description: string }> = {
      applied: {
        title: this.i18nService.translate('vacancies.events.template.appliedTitle'),
        description: this.i18nService.translate('vacancies.events.template.appliedDescription')
      },
      response_received: {
        title: this.i18nService.translate('vacancies.events.template.responseTitle'),
        description: this.i18nService.translate('vacancies.events.template.responseDescription')
      },
      interview_scheduled: {
        title: this.i18nService.translate('vacancies.events.template.interviewTitle'),
        description: this.i18nService.translate('vacancies.events.template.interviewDescription')
      },
      interview_completed: {
        title: this.i18nService.translate('vacancies.events.template.interviewCompletedTitle'),
        description: this.i18nService.translate('vacancies.events.template.interviewCompletedDescription')
      },
      follow_up_scheduled: {
        title: this.i18nService.translate('vacancies.events.template.followUpTitle'),
        description: this.i18nService.translate('vacancies.events.template.followUpDescription')
      },
      follow_up_sent: {
        title: this.i18nService.translate('vacancies.events.template.followUpSentTitle'),
        description: this.i18nService.translate('vacancies.events.template.followUpSentDescription')
      },
      note_added: {
        title: this.i18nService.translate('vacancies.events.template.noteTitle'),
        description: this.i18nService.translate('vacancies.events.template.noteDescription')
      },
      technical_test_sent: {
        title: this.i18nService.translate('vacancies.events.template.technicalTestTitle'),
        description: this.i18nService.translate('vacancies.events.template.technicalTestDescription')
      },
      hired: {
        title: this.i18nService.translate('vacancies.events.template.hiredTitle'),
        description: this.i18nService.translate('vacancies.events.template.hiredDescription')
      },
      rejected: {
        title: this.i18nService.translate('vacancies.events.template.rejectedTitle'),
        description: this.i18nService.translate('vacancies.events.template.rejectedDescription')
      },
      withdrawn: {
        title: this.i18nService.translate('vacancies.events.template.withdrawnTitle'),
        description: this.i18nService.translate('vacancies.events.template.withdrawnDescription')
      }
    };

    this.eventForm.patchValue({
      title: templateMap[eventType].title,
      description: templateMap[eventType].description,
      eventAt: localDateTime,
      statusAfter: '',
      processStage: '',
      companyResponse: '',
      contactName: '',
      contactChannel: '',
      interviewType: '',
      interviewDate: '',
      interviewResult: '',
      interviewEvaluatedSkills: '',
      interviewHighlights: '',
      interviewNotes: '',
      followUpDate: '',
      followUpSubject: '',
      followUpMessage: '',
      cvFileName: '',
      coverLetterFileName: '',
      recommendationFileName: '',
      presentationText: '',
      rejectionReason: ''
    });
    this.lastCalendarUrl.set(null);
  }
}
