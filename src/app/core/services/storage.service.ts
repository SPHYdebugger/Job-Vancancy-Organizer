import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  public getItem<T>(key: string): T | null {
    const rawValue = localStorage.getItem(key) ?? sessionStorage.getItem(key);

    if (!rawValue) {
      return null;
    }

    try {
      return JSON.parse(rawValue) as T;
    } catch {
      return null;
    }
  }

  public setItem<T>(key: string, value: T, persist = true): void {
    const selectedStorage = persist ? localStorage : sessionStorage;
    const fallbackStorage = persist ? sessionStorage : localStorage;

    selectedStorage.setItem(key, JSON.stringify(value));
    fallbackStorage.removeItem(key);
  }

  public removeItem(key: string): void {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}
