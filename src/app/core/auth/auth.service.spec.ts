import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthService);
  });

  it('should authenticate with valid demo credentials', async () => {
    const result = await service.login({
      username: environment.auth.demoUser.username,
      password: environment.auth.demoUser.password
    });

    expect(result.success).toBeTrue();
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.getSession()?.username).toBe(environment.auth.demoUser.username);
  });

  it('should reject invalid credentials', async () => {
    const result = await service.login({
      username: 'invalid.user',
      password: 'wrong-password'
    });

    expect(result.success).toBeFalse();
    expect(service.isAuthenticated()).toBeFalse();
    expect(result.messageKey).toBeTruthy();
  });

  it('should keep session in sessionStorage when rememberSession is false', async () => {
    const result = await service.login({
      username: environment.auth.demoUser.username,
      password: environment.auth.demoUser.password,
      rememberSession: false
    });

    expect(result.success).toBeTrue();
    expect(sessionStorage.getItem('jvo.auth.session')).toBeTruthy();
    expect(localStorage.getItem('jvo.auth.session')).toBeNull();
  });

  it('should register and authenticate a local user without storing its plaintext password', async () => {
    const registerResult = await service.register({
      name: 'Test User',
      email: 'test.user@local.dev',
      password: 'StrongPass#2026'
    });

    expect(registerResult.success).toBeTrue();

    const storedUsers = JSON.parse(localStorage.getItem('jvo.auth.users') ?? '[]') as Array<Record<string, unknown>>;
    expect(storedUsers[0]['password']).toBeUndefined();
    expect(storedUsers[0]['passwordHash']).toBeTruthy();

    const loginResult = await service.login({
      username: 'test.user@local.dev',
      password: 'StrongPass#2026'
    });

    expect(loginResult.success).toBeTrue();
    expect(service.getSession()?.isDemo).toBeFalse();
    expect(service.getSession()?.email).toBe('test.user@local.dev');
  });

  it('should upgrade a legacy plaintext password after a valid login', async () => {
    localStorage.setItem('jvo.auth.users', JSON.stringify([{
      id: 'legacy-user',
      name: 'Legacy User',
      email: 'legacy@local.dev',
      password: 'LegacyPass#2026',
      createdAt: '2026-01-01T00:00:00.000Z'
    }]));

    const result = await service.login({ username: 'legacy@local.dev', password: 'LegacyPass#2026' });
    const storedUsers = JSON.parse(localStorage.getItem('jvo.auth.users') ?? '[]') as Array<Record<string, unknown>>;

    expect(result.success).toBeTrue();
    expect(storedUsers[0]['password']).toBeUndefined();
    expect(storedUsers[0]['passwordHash']).toBeTruthy();
  });
});
