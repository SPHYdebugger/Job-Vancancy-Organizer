import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { VacancyService } from '../../services/vacancy.service';

@Component({
  selector: 'app-vacancy-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, MatButtonModule],
  templateUrl: './vacancy-detail.page.html',
  styleUrl: './vacancy-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacancyDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly vacancyService = inject(VacancyService);

  private readonly vacancyId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly vacancy = computed(() => this.vacancyService.getById(this.vacancyId));

  protected deleteVacancy(): void {
    const currentVacancy = this.vacancy();

    if (!currentVacancy) {
      return;
    }

    const shouldDelete = confirm(`Delete vacancy "${currentVacancy.company} - ${currentVacancy.position}"?`);

    if (!shouldDelete) {
      return;
    }

    this.vacancyService.remove(currentVacancy.id);
    void this.router.navigate(['/app/vacancies']);
  }
}
