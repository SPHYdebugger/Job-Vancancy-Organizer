import { Injectable, computed, signal } from '@angular/core';

import { TranslationKey, translations } from './translations';

export type AppLanguage = 'en' | 'es';

const LANGUAGE_STORAGE_KEY = 'jvo.language';

@Injectable({
  providedIn: 'root'
})
export class I18nService {
  private readonly languageSignal = signal<AppLanguage>(this.getInitialLanguage());

  public readonly language = this.languageSignal.asReadonly();
  public readonly locale = computed(() => (this.language() === 'es' ? 'es-ES' : 'en-US'));

  constructor() {
    // Persist the detected language on first access so subsequent sessions keep the last used value.
    if (!localStorage.getItem(LANGUAGE_STORAGE_KEY)) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, this.language());
    }
  }

  public setLanguage(language: AppLanguage): void {
    this.languageSignal.set(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }

  public translate(key: TranslationKey | string, params?: Record<string, string | number>): string {
    const dictionary = translations[this.language()];
    const rawText = (dictionary as Record<string, string>)[key] ?? key;

    if (!params) {
      return rawText;
    }

    return Object.entries(params).reduce((accumulator, [paramName, paramValue]) => {
      const token = `{{${paramName}}}`;
      return accumulator.replaceAll(token, String(paramValue));
    }, rawText);
  }

  private getInitialLanguage(): AppLanguage {
    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (storedLanguage === 'en' || storedLanguage === 'es') {
      return storedLanguage;
    }

    const browserLanguage = navigator.language.toLowerCase();
    return browserLanguage.startsWith('es') ? 'es' : 'en';
  }
}
