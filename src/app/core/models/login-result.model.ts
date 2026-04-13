import { AuthSession } from './auth-session.model';

export interface LoginResult {
  success: boolean;
  message?: string;
  session?: AuthSession;
}
