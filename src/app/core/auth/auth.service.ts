import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthUser } from '../models/auth-user.model';
import { AuthSession } from '../models/auth-session.model';
import { LoginCredentials } from '../models/login-credentials.model';
import { LoginResult } from '../models/login-result.model';
import { RegisterResult, RegisterUserInput } from '../models/register-user.model';
import { StorageService } from '../services/storage.service';

const AUTH_SESSION_KEY = 'jvo.auth.session';
const AUTH_USERS_KEY = 'jvo.auth.users';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly sessionSubject: BehaviorSubject<AuthSession | null>;
  public readonly session$: Observable<AuthSession | null>;

  constructor(private readonly storageService: StorageService) {
    const persistedSession = this.normalizePersistedSession(this.storageService.getItem<AuthSession>(AUTH_SESSION_KEY));
    this.sessionSubject = new BehaviorSubject<AuthSession | null>(persistedSession);
    this.session$ = this.sessionSubject.asObservable();
  }

  public getSession(): AuthSession | null {
    return this.sessionSubject.value;
  }

  public isAuthenticated(): boolean {
    return this.getSession() !== null;
  }

  public isDemoSession(): boolean {
    return this.getSession()?.isDemo ?? false;
  }

  public getCurrentUserId(): string | null {
    return this.getSession()?.userId ?? null;
  }

  public login(credentials: LoginCredentials): LoginResult {
    const identifier = credentials.username.trim().toLowerCase();
    const password = credentials.password;
    const rememberSession = credentials.rememberSession ?? true;
    const configuredDemoUser = environment.auth.demoUser;
    const demoUserId = configuredDemoUser.username.trim().toLowerCase();

    const isDemoIdentifier =
      identifier === configuredDemoUser.username.trim().toLowerCase() ||
      identifier === `${configuredDemoUser.username.trim().toLowerCase()}@local.demo` ||
      identifier === 'demo';

    if (isDemoIdentifier && password === configuredDemoUser.password) {
      const session: AuthSession = {
        userId: demoUserId,
        username: configuredDemoUser.username.trim().toLowerCase(),
        email: `${configuredDemoUser.username.trim().toLowerCase()}@local.demo`,
        displayName: configuredDemoUser.displayName,
        isDemo: true,
        startedAt: new Date().toISOString()
      };

      this.storageService.setItem(AUTH_SESSION_KEY, session, rememberSession);
      this.sessionSubject.next(session);

      return {
        success: true,
        session
      };
    }

    const users = this.getRegisteredUsers();
    const matchedUser = users.find((user) => user.email.toLowerCase() === identifier);

    if (!matchedUser || matchedUser.password !== password) {
      return {
        success: false,
        messageKey: 'auth.invalidCredentials'
      };
    }

    const session: AuthSession = {
      userId: matchedUser.id,
      username: matchedUser.email.toLowerCase(),
      email: matchedUser.email.toLowerCase(),
      displayName: matchedUser.name,
      isDemo: false,
      startedAt: new Date().toISOString()
    };

    this.storageService.setItem(AUTH_SESSION_KEY, session, rememberSession);
    this.sessionSubject.next(session);

    return {
      success: true,
      session
    };
  }

  public register(input: RegisterUserInput): RegisterResult {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (!name || !email || !password) {
      return {
        success: false,
        messageKey: 'auth.register.invalidData'
      };
    }

    const demoUsername = environment.auth.demoUser.username.trim().toLowerCase();
    if (email === demoUsername || email === `${demoUsername}@local.demo`) {
      return {
        success: false,
        messageKey: 'auth.register.emailAlreadyUsed'
      };
    }

    const users = this.getRegisteredUsers();
    const exists = users.some((user) => user.email.toLowerCase() === email);

    if (exists) {
      return {
        success: false,
        messageKey: 'auth.register.emailAlreadyUsed'
      };
    }

    const newUser: AuthUser = {
      id: `user_${crypto.randomUUID()}`,
      name,
      email,
      password,
      createdAt: new Date().toISOString()
    };

    this.storageService.setItem(AUTH_USERS_KEY, [...users, newUser]);

    return { success: true };
  }

  public logout(): void {
    this.storageService.removeItem(AUTH_SESSION_KEY);
    this.sessionSubject.next(null);
  }

  private getRegisteredUsers(): AuthUser[] {
    return this.storageService.getItem<AuthUser[]>(AUTH_USERS_KEY) ?? [];
  }

  private normalizePersistedSession(rawSession: AuthSession | null): AuthSession | null {
    if (!rawSession) {
      return null;
    }

    if (rawSession.userId && rawSession.email && typeof rawSession.isDemo === 'boolean') {
      return rawSession;
    }

    const username = rawSession.username?.trim().toLowerCase() ?? '';
    const demoUsername = environment.auth.demoUser.username.trim().toLowerCase();
    const isDemo = username === demoUsername;

    const normalizedSession: AuthSession = {
      userId: isDemo ? demoUsername : `legacy_${username}`,
      username,
      email: isDemo ? `${demoUsername}@local.demo` : username,
      displayName: rawSession.displayName,
      isDemo,
      startedAt: rawSession.startedAt
    };

    this.storageService.setItem(AUTH_SESSION_KEY, normalizedSession);
    return normalizedSession;
  }
}
