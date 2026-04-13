import { Injectable } from '@angular/core';

import { AuthSession } from '../models/auth-session.model';
import { StorageService } from '../services/storage.service';

const AUTH_SESSION_KEY = 'jvo.auth.session';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  constructor(private readonly storageService: StorageService) {}

  public getSession(): AuthSession | null {
    return this.storageService.getItem<AuthSession>(AUTH_SESSION_KEY);
  }

  public isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  public login(username: string): void {
    const session: AuthSession = {
      username,
      displayName: 'Backend Developer',
      startedAt: new Date().toISOString()
    };

    this.storageService.setItem(AUTH_SESSION_KEY, session);
  }

  public logout(): void {
    this.storageService.removeItem(AUTH_SESSION_KEY);
  }
}
