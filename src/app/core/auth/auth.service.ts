import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthSession } from '../models/auth-session.model';
import { LoginCredentials } from '../models/login-credentials.model';
import { LoginResult } from '../models/login-result.model';
import { StorageService } from '../services/storage.service';

const AUTH_SESSION_KEY = 'jvo.auth.session';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly sessionSubject: BehaviorSubject<AuthSession | null>;
  public readonly session$: Observable<AuthSession | null>;

  constructor(private readonly storageService: StorageService) {
    const persistedSession = this.storageService.getItem<AuthSession>(AUTH_SESSION_KEY);
    this.sessionSubject = new BehaviorSubject<AuthSession | null>(persistedSession);
    this.session$ = this.sessionSubject.asObservable();
  }

  public getSession(): AuthSession | null {
    return this.sessionSubject.value;
  }

  public isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  public login(credentials: LoginCredentials): LoginResult {
    const username = credentials.username.trim().toLowerCase();
    const password = credentials.password;
    const rememberSession = credentials.rememberSession ?? true;
    const configuredDemoUser = environment.auth.demoUser;

    if (username !== configuredDemoUser.username || password !== configuredDemoUser.password) {
      return {
        success: false,
        message: 'Invalid credentials. Please check the demo account details and try again.'
      };
    }

    const session: AuthSession = {
      username,
      displayName: configuredDemoUser.displayName,
      startedAt: new Date().toISOString()
    };

    this.storageService.setItem(AUTH_SESSION_KEY, session, rememberSession);
    this.sessionSubject.next(session);

    return {
      success: true,
      session
    };
  }

  public logout(): void {
    this.storageService.removeItem(AUTH_SESSION_KEY);
    this.sessionSubject.next(null);
  }
}
