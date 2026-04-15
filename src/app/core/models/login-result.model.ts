import { AuthSession } from './auth-session.model';

export interface LoginResult {
  success: boolean;
  messageKey?: string;
  session?: AuthSession;
}
