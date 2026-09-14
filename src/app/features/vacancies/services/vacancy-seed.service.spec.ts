import { Vacancy } from '../../../core/models/vacancy.model';
import { buildDynamicDemoVacancies } from './vacancy-seed.service';

describe('buildDynamicDemoVacancies', () => {
  const now = new Date(2026, 8, 16, 18, 0, 0);

  it('distributes twelve vacancies across the requested demo weeks', () => {
    const vacancies = Array.from({ length: 12 }, (_, index) => createVacancy(index));

    const result = buildDynamicDemoVacancies(vacancies, now);

    expect(countByWeekOffset(result, now)).toEqual({ '-2': 4, '-1': 2, '0': 6 });
  });

  it('uses the exact 30/20/50 distribution when the record count allows it', () => {
    const vacancies = Array.from({ length: 10 }, (_, index) => createVacancy(index));

    const result = buildDynamicDemoVacancies(vacancies, now);

    expect(countByWeekOffset(result, now)).toEqual({ '-2': 3, '-1': 2, '0': 5 });
  });

  it('is deterministic during the day and keeps related dates coherent', () => {
    const vacancies = Array.from({ length: 12 }, (_, index) => createVacancy(index));

    const first = buildDynamicDemoVacancies(vacancies, now);
    const second = buildDynamicDemoVacancies(vacancies, new Date(2026, 8, 16, 23, 0, 0));

    expect(first.map((vacancy) => vacancy.applicationDate)).toEqual(
      second.map((vacancy) => vacancy.applicationDate)
    );
    first.forEach((vacancy) => {
      expect(new Date(vacancy.createdAt).getTime()).toBeLessThanOrEqual(
        new Date(vacancy.applicationDate!).getTime()
      );
      expect(new Date(vacancy.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(vacancy.applicationDate!).getTime()
      );
      expect(new Date(vacancy.updatedAt).getTime()).toBeLessThanOrEqual(now.getTime());
      if (vacancy.followUpPending) {
        expect(vacancy.nextFollowUpDate).not.toBeNull();
        expect(new Date(vacancy.nextFollowUpDate!).getTime()).toBeGreaterThan(now.getTime());
      }
    });
  });
});

function countByWeekOffset(vacancies: Vacancy[], now: Date): Record<string, number> {
  const currentWeekStart = startOfWeek(now);
  return vacancies.reduce<Record<string, number>>((counts, vacancy) => {
    const applicationWeek = startOfWeek(new Date(`${vacancy.applicationDate}T12:00:00`));
    const offset = Math.round((applicationWeek.getTime() - currentWeekStart.getTime()) / (7 * 86_400_000));
    counts[offset] = (counts[offset] ?? 0) + 1;
    return counts;
  }, {});
}

function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  result.setHours(0, 0, 0, 0);
  return result;
}

function createVacancy(index: number): Vacancy {
  const timestamp = '2026-01-01T10:00:00.000Z';
  return {
    id: `demo-${index}`,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
    closedAt: null,
    company: `FAKE Company ${index}`,
    position: '[FAKE] Backend Engineer',
    domain: null,
    location: null,
    headquarters: null,
    modality: 'remote',
    employmentType: 'full_time',
    seniority: 'mid',
    techStack: [],
    salaryText: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    offerSource: null,
    sourceType: 'job_board',
    offerUrl: null,
    companyUrl: null,
    contactName: null,
    contactEmail: null,
    contactLinkedin: null,
    lastContactAt: timestamp,
    applicationStatus: 'applied',
    processStage: null,
    companyResponse: 'pending',
    priority: 'medium',
    discoveredAt: timestamp,
    applicationDate: '2026-01-01',
    lastStatusChangeAt: timestamp,
    nextFollowUpDate: index % 2 === 0 ? '2026-01-10' : null,
    followUpPending: index % 2 === 0,
    favorite: false,
    archived: false,
    rejectionReason: null,
    closureReason: null,
    notes: null,
    hrObservations: null,
    tags: ['fake']
  };
}
