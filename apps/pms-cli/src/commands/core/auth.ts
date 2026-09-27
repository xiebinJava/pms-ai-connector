import { BrowserAuth } from "../../auth/BrowserAuth.js";
import { AuthStore } from "../../auth/AuthStore.js";

export interface AuthCommandOptions {
  baseUrl: string;
  authOrigin: string;
  store?: AuthStore;
}

export async function authLogin(options: AuthCommandOptions) {
  const store = options.store ?? new AuthStore();
  return new BrowserAuth({ ...options, store }).login();
}

export async function authStatus(store = new AuthStore()) {
  const account = await store.getActiveAccount();
  return account ? { loggedIn: true, accountId: account.accountId, displayName: account.displayName, baseUrl: account.baseUrl } : { loggedIn: false };
}

export async function authLogout(options: AuthCommandOptions) {
  const store = options.store ?? new AuthStore();
  const account = await store.getActiveAccount();
  if (!account) return { loggedOut: true };
  await new BrowserAuth({ ...options, store }).logout(account);
  return { loggedOut: true };
}
