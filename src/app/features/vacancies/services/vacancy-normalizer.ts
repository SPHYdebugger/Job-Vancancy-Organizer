import { Vacancy } from '../../../core/models/vacancy.model';
import { VacancyEvent } from '../../../core/models/vacancy-event.model';
import { VacancyFollowUp } from '../../../core/models/vacancy-followup.model';

export function normalizeVacancy(input: Partial<Vacancy> & Record<string, unknown>): Vacancy {
  const now = new Date().toISOString();
  const createdAt = asString(input.createdAt) ?? now;
  const updatedAt = asString(input.updatedAt) ?? asString(input['lastUpdatedAt']) ?? createdAt;
  const applicationStatus = (asString(input.applicationStatus) as Vacancy['applicationStatus']) ?? 'saved';
  const followUpPending = asBoolean(input.followUpPending);
  const nextFollowUpDate = asNullableString(input.nextFollowUpDate);

  return {
    id: asString(input.id) ?? crypto.randomUUID(),
    createdAt,
    updatedAt,
    archivedAt: asNullableString(input.archivedAt),
    closedAt: asNullableString(input.closedAt),
    company: asString(input.company) ?? '',
    position: asString(input.position) ?? '',
    domain: asString(input.domain) ?? '',
    location: asString(input.location) ?? asString(input.headquarters) ?? '',
    headquarters: asString(input.headquarters) ?? '',
    modality: (asString(input.modality) as Vacancy['modality']) ?? 'remote',
    employmentType: (asString(input.employmentType) as Vacancy['employmentType']) ?? 'full_time',
    seniority: (asString(input.seniority) as Vacancy['seniority']) ?? 'unknown',
    techStack: asStringArray(input.techStack),
    salaryText: asString(input.salaryText) ?? asString(input['salary']) ?? '',
    salaryMin: asNullableNumber(input.salaryMin),
    salaryMax: asNullableNumber(input.salaryMax),
    salaryCurrency: asNullableString(input.salaryCurrency),
    offerSource: asString(input.offerSource) ?? '',
    sourceType: (asString(input.sourceType) as Vacancy['sourceType']) ?? 'job_board',
    offerUrl: asString(input.offerUrl) ?? '',
    companyUrl: asString(input.companyUrl) ?? '',
    contactName: asString(input.contactName) ?? '',
    contactEmail: asString(input.contactEmail) ?? '',
    contactLinkedin: asString(input.contactLinkedin) ?? '',
    lastContactAt: asNullableString(input.lastContactAt) ?? asNullableString(input['contactDate']),
    applicationStatus,
    processStage: asString(input.processStage) ?? '',
    companyResponse: (asString(input.companyResponse) as Vacancy['companyResponse']) ?? 'none',
    priority: (asString(input.priority) as Vacancy['priority']) ?? 'medium',
    discoveredAt: asNullableString(input.discoveredAt) ?? createdAt,
    applicationDate: asNullableString(input.applicationDate),
    lastStatusChangeAt: asNullableString(input.lastStatusChangeAt) ?? updatedAt,
    nextFollowUpDate,
    followUpPending,
    favorite: asBoolean(input.favorite),
    archived: asBoolean(input.archived),
    rejectionReason: asString(input.rejectionReason) ?? '',
    closureReason: asString(input.closureReason) ?? '',
    notes: asString(input.notes) ?? '',
    hrObservations: asString(input.hrObservations) ?? '',
    tags: asStringArray(input.tags)
  };
}

export function createDefaultEvent(vacancy: Vacancy, actorId: string | null): VacancyEvent {
  return {
    id: `evt_${crypto.randomUUID()}`,
    vacancyId: vacancy.id,
    type: 'created',
    title: 'Vacancy created',
    description: 'Vacancy record initialized.',
    previousStatus: null,
    newStatus: vacancy.applicationStatus,
    eventAt: vacancy.createdAt,
    createdAt: vacancy.createdAt,
    actorType: actorId ? 'user' : 'system',
    actorId,
    metadata: {}
  };
}

export function createFollowUpFromVacancy(vacancy: Vacancy): VacancyFollowUp | null {
  if (!vacancy.followUpPending || !vacancy.nextFollowUpDate) {
    return null;
  }

  return {
    id: `fol_${crypto.randomUUID()}`,
    vacancyId: vacancy.id,
    plannedDate: vacancy.nextFollowUpDate,
    completedAt: null,
    status: 'pending',
    channel: 'email',
    subject: `Follow-up ${vacancy.company} - ${vacancy.position}`,
    message: '',
    responseReceived: false,
    responseSummary: '',
    createdAt: vacancy.updatedAt,
    updatedAt: vacancy.updatedAt
  };
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNullableString(value: unknown): string | null {
  const resolved = asString(value);
  return resolved ?? null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => `${item}`.trim())
    .filter((item) => item.length > 0);
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  return null;
}
