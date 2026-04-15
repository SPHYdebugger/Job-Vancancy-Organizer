export interface AuthSession {
  userId: string;
  username: string;
  email: string;
  displayName: string;
  isDemo: boolean;
  startedAt: string;
}
