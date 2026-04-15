export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
}

export interface RegisterResult {
  success: boolean;
  messageKey?: string;
}

