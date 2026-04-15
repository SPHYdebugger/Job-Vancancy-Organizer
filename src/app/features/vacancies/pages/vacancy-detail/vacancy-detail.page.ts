import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { I18nService } from '../../../../core/i18n/i18n.service';
import { VacancyPriority, VacancyStatus, WorkModality } from '../../../../core/models/vacancy.model';
import { TranslatePipe } from '../../../../shared/pipes/translate.pipe';
import { modalityToTranslationKey, priorityToTranslationKey, statusToTranslationKey } from '../../../../shared/utils/label-mappers';
import { VacancyService } from '../../services/vacancy.service';

@Component({
  selector: 'app-vacancy-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, MatButtonModule, TranslatePipe],
  templateUrl: './vacancy-detail.page.html',
  styleUrl: './vacancy-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VacancyDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18nService = inject(I18nService);
  private readonly vacancyService = inject(VacancyService);

  private readonly vacancyId = this.route.snapshot.paramMap.get('id') ?? '';
  protected readonly vacancy = computed(() => this.vacancyService.getById(this.vacancyId));
  protected readonly locale = this.i18nService.locale;

  protected deleteVacancy(): void {
    const currentVacancy = this.vacancy();

    if (!currentVacancy) {
      return;
    }

    const shouldDelete = confirm(
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

  protected statusLabel(status: VacancyStatus): string {
    return this.i18nService.translate(statusToTranslationKey(status));
  }

  protected priorityLabel(priority: VacancyPriority): string {
    return this.i18nService.translate(priorityToTranslationKey(priority));
  }

  protected modalityLabel(modality: WorkModality): string {
    return this.i18nService.translate(modalityToTranslationKey(modality));
  }
}
