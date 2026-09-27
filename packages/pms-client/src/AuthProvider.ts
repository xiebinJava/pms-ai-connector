export interface AuthProvider {
  getToken(): Promise<string>;
}

export class AuthProviderError extends Error {
  readonly name = "AuthProviderError";
}

export class StaticTokenProvider implements AuthProvider {
  constructor(private readonly token: string) {
    if (!token.trim()) throw new AuthProviderError("认证 Token 不能为空");
  }

  async getToken(): Promise<string> {
    return this.token;
  }
}

export class EnvTokenProvider implements AuthProvider {
  constructor(
    private readonly env: Record<string, string | undefined>,
    private readonly variableName = "PMS_AUTH_TOKEN",
  ) {}

  async getToken(): Promise<string> {
    const token = this.env[this.variableName]?.trim();
    if (!token) {
      throw new AuthProviderError(`${this.variableName} 未配置`);
    }
    return token;
  }
}

export function authProviderFromEnv(
  env: Record<string, string | undefined>,
  variableName = "PMS_AUTH_TOKEN",
): AuthProvider {
  return new EnvTokenProvider(env, variableName);
}
