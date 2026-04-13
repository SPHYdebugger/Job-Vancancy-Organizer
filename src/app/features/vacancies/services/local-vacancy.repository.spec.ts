import { TestBed } from '@angular/core/testing';

import { StorageService } from '../../../core/services/storage.service';
import { Vacancy } from '../../../core/models/vacancy.model';
import { LocalVacancyRepository } from './local-vacancy.repository';

describe('LocalVacancyRepository', () => {
  let repository: LocalVacancyRepository;

  const fakeVacancy: Vacancy = {
    id: 'vac-test-001',
    createdAt: '2026-04-10T10:00:00.000Z',
    company: 'FAKE Test Company',
    position: '[FAKE] Test Backend Role',
    domain: 'Testing',
    headquarters: 'Madrid, Spain',
    modality: 'remote',
    techStack: ['TypeScript'],
    salary: 'EUR 50k - 60k',
    offerSource: 'Test',
    offerUrl: 'https://example.com/test',
    companyUrl: 'https://example.com/test-company',
    contactName: 'Test User',
    contactDate: null,
    message: 'Test vacancy',
    cvSent: true,
    responseReceived: false,
    applicationStatus: 'pending',
    processStage: 'Seeded',
    priority: 'medium',
    applicationDate: '2026-04-10',
    lastUpdatedAt: '2026-04-10T10:00:00.000Z',
    interviewCompleted: false,
    technicalInterview: false,
    companyResponse: 'none',
    rejected: false,
    rejectionReason: '',
    followUpPending: false,
    nextFollowUpDate: null,
    notes: '',
    hrObservations: '',
    tags: ['fake']
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [StorageService, LocalVacancyRepository]
    });

    repository = TestBed.inject(LocalVacancyRepository);
  });

  it('should create and retrieve a vacancy', () => {
    repository.create(fakeVacancy);

    expect(repository.count()).toBe(1);
    expect(repository.getById(fakeVacancy.id)?.company).toContain('FAKE');
  });

  it('should update and remove a vacancy', () => {
    repository.create(fakeVacancy);
    repository.update(fakeVacancy.id, { applicationStatus: 'in_review' });

    expect(repository.getById(fakeVacancy.id)?.applicationStatus).toBe('in_review');

    repository.remove(fakeVacancy.id);
    expect(repository.count()).toBe(0);
  });
});
