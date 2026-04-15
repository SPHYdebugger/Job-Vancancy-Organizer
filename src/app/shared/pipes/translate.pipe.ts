import { Pipe, PipeTransform, inject } from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';

@Pipe({
  name: 't',
  standalone: true,
  pure: false
})
export class TranslatePipe implements PipeTransform {
  private readonly i18nService = inject(I18nService);

  public transform(key: string, params?: Record<string, string | number>): string {
    return this.i18nService.translate(key, params);
  }
}
