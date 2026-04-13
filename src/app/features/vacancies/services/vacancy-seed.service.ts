import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { Vacancy } from '../../../core/models/vacancy.model';
import { StorageService } from '../../../core/services/storage.service';
import { VACANCY_REPOSITORY } from '../../../core/services/vacancy-repository.token';
import { inject } from '@angular/core';

const SEED_FLAG_KEY = 'jvo.vacancies.seeded.v1';

@Injectable({
  providedIn: 'root'
})
export class VacancySeedService {
  private readonly vacancyRepository = inject(VACANCY_REPOSITORY);

  constructor(
    private readonly httpClient: HttpClient,
    private readonly storageService: StorageService
  ) {}

  public async initialize(): Promise<void> {
    const isSeedCompleted = this.storageService.getItem<boolean>(SEED_FLAG_KEY) ?? false;

    if (isSeedCompleted && this.vacancyRepository.count() > 0) {
      return;
    }

    const seedVacancies = await firstValueFrom(
      this.httpClient.get<Vacancy[]>('assets/mocks/vacancies.seed.json')
    );

    const normalizedVacancies = seedVacancies.map((vacancy) => this.ensureFakeMarker(vacancy));

    this.vacancyRepository.replaceAll(normalizedVacancies);
    this.storageService.setItem(SEED_FLAG_KEY, true);
  }

  private ensureFakeMarker(vacancy: Vacancy): Vacancy {
    const fakeCompany = vacancy.company.includes('FAKE') ? vacancy.company : `FAKE ${vacancy.company}`;
    const fakePosition = vacancy.position.includes('FAKE')
      ? vacancy.position
      : `[FAKE] ${vacancy.position}`;

    return {
      ...vacancy,
      company: fakeCompany,
      position: fakePosition
    };
  }
}
