export interface Account {
  accountId: string;
  baseUrl: string;
  displayName: string;
  refreshToken: string;
}

export interface Keyring {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

const SERVICE = "pms-cli";
const ACTIVE_KEY = `${SERVICE}:active-account`;

class KeytarKeyring implements Keyring {
  private async module() {
    return import("keytar");
  }

  async get(key: string): Promise<string | null> {
    return (await this.module()).getPassword(SERVICE, key);
  }

  async set(key: string, value: string): Promise<void> {
    await (await this.module()).setPassword(SERVICE, key, value);
  }

  async delete(key: string): Promise<void> {
    await (await this.module()).deletePassword(SERVICE, key);
  }
}

export class AuthStore {
  constructor(private readonly keyring: Keyring = new KeytarKeyring()) {}

  async getActiveAccount(): Promise<Account | null> {
    const accountId = await this.keyring.get(ACTIVE_KEY);
    if (!accountId) return null;
    const raw = await this.keyring.get(this.accountKey(accountId));
    if (!raw) return null;
    try {
      const account = JSON.parse(raw) as Account;
      if (!account.accountId || !account.baseUrl || !account.refreshToken) return null;
      return account;
    } catch {
      return null;
    }
  }

  async save(account: Account): Promise<void> {
    if (!account.accountId || !account.baseUrl || !account.refreshToken) {
      throw new Error("账号凭据不完整");
    }
    await this.keyring.set(this.accountKey(account.accountId), JSON.stringify({
      accountId: account.accountId,
      baseUrl: account.baseUrl,
      displayName: account.displayName,
      refreshToken: account.refreshToken,
    } satisfies Account));
    await this.keyring.set(ACTIVE_KEY, account.accountId);
  }

  async remove(accountId: string): Promise<void> {
    await this.keyring.delete(this.accountKey(accountId));
    if (await this.keyring.get(ACTIVE_KEY) === accountId) await this.keyring.delete(ACTIVE_KEY);
  }

  private accountKey(accountId: string): string {
    return `${SERVICE}:account:${accountId}`;
  }
}
