export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /** Legacy plaintext value. Removed automatically after the next successful login. */
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordIterations?: number;
  createdAt: string;
}

