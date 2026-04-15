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

  it('should authenticate with valid demo credentials', () => {
    const result = service.login({
      username: environment.auth.demoUser.username,
      password: environment.auth.demoUser.password
    });

    expect(result.success).toBeTrue();
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.getSession()?.username).toBe(environment.auth.demoUser.username);
  });

  it('should reject invalid credentials', () => {
    const result = service.login({
      username: 'invalid.user',
      password: 'wrong-password'
    });

    expect(result.success).toBeFalse();
    expect(service.isAuthenticated()).toBeFalse();
    expect(result.messageKey).toBeTruthy();
  });

  it('should keep session in sessionStorage when rememberSession is false', () => {
    const result = service.login({
      username: environment.auth.demoUser.username,
      password: environment.auth.demoUser.password,
      rememberSession: false
    });

    expect(result.success).toBeTrue();
    expect(sessionStorage.getItem('jvo.auth.session')).toBeTruthy();
    expect(localStorage.getItem('jvo.auth.session')).toBeNull();
  });

  it('should register and authenticate a local user', () => {
    const registerResult = service.register({
      name: 'Test User',
      email: 'test.user@local.dev',
      password: 'StrongPass#2026'
    });

    expect(registerResult.success).toBeTrue();

    const loginResult = service.login({
      username: 'test.user@local.dev',
      password: 'StrongPass#2026'
    });

    expect(loginResult.success).toBeTrue();
    expect(service.getSession()?.isDemo).toBeFalse();
    expect(service.getSession()?.email).toBe('test.user@local.dev');
  });
});
