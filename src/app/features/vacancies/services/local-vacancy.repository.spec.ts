import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';
import { StorageService } from '../../../core/services/storage.service';
import { Vacancy } from '../../../core/models/vacancy.model';
import { LocalVacancyRepository } from './local-vacancy.repository';

describe('LocalVacancyRepository', () => {
  let repository: LocalVacancyRepository;
  let authService: AuthService;

  const fakeVacancy: Vacancy = {
    id: 'vac-test-001',
    deletedAt: null,
    createdAt: '2026-04-10T10:00:00.000Z',
    updatedAt: '2026-04-10T10:00:00.000Z',
    archivedAt: null,
    closedAt: null,
    company: 'FAKE Test Company',
    position: '[FAKE] Test Backend Role',
    domain: 'Testing',
    location: 'Madrid, Spain',
    headquarters: 'Madrid, Spain',
    modality: 'remote',
    employmentType: 'full_time',
    seniority: 'unknown',
    techStack: ['TypeScript'],
    salaryText: 'EUR 50k - 60k',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    offerSource: 'Test',
    sourceType: 'job_board',
    offerUrl: 'https://example.com/test',
    companyUrl: 'https://example.com/test-company',
    contactName: 'Test User',
    contactEmail: '',
    contactLinkedin: '',
    lastContactAt: null,
    applicationStatus: 'pending',
    processStage: 'Seeded',
    priority: 'medium',
    companyResponse: 'none',
    discoveredAt: '2026-04-10T10:00:00.000Z',
    applicationDate: '2026-04-10',
    lastStatusChangeAt: '2026-04-10T10:00:00.000Z',
    nextFollowUpDate: null,
    followUpPending: false,
    favorite: false,
    archived: false,
    rejectionReason: '',
    closureReason: '',
    notes: '',
    hrObservations: '',
    tags: ['fake']
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [StorageService, AuthService, LocalVacancyRepository]
    });

    authService = TestBed.inject(AuthService);
    authService.login({
      username: environment.auth.demoUser.username,
      password: environment.auth.demoUser.password
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
