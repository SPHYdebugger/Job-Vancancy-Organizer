import { CompanyResponseState, VacancyPriority, VacancyStatus, WorkModality } from '../../core/models/vacancy.model';
import { TranslationKey } from '../../core/i18n/translations';

export function statusToTranslationKey(status: VacancyStatus): TranslationKey {
  return `status.${status}`;
}

export function priorityToTranslationKey(priority: VacancyPriority): TranslationKey {
  return `priority.${priority}`;
}

export function modalityToTranslationKey(modality: WorkModality): TranslationKey {
  return `modality.${modality}`;
}

export function responseToTranslationKey(response: CompanyResponseState): TranslationKey {
  return `response.${response}`;
}

export function dashboardStatusToTranslationKey(status: string): TranslationKey {
  const normalized = status.toLowerCase().replace(/\s+/g, '_').replace('-', '_');
  const allowed: Record<string, TranslationKey> = {
    pending: 'status.pending',
    cv_sent: 'status.cv_sent',
    applied: 'status.applied',
    in_review: 'status.in_review',
    hr_contact: 'status.hr_contact',
    interview: 'status.interview',
    technical_test: 'status.technical_test',
    finalist: 'status.finalist',
    rejected: 'status.rejected',
    no_response: 'status.no_response',
    hired: 'status.hired'
  };

  return allowed[normalized] ?? 'status.pending';
}

