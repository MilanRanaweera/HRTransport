import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, onExpired, restoreToken, setToken } from './api';
import { User } from './types';
type Session = { user: User | null; loading: boolean; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>; refresh: () => Promise<void> };
const Context = createContext<Session>(null!);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  const refresh = async () => setUser(await api<User>('/me'));
  useEffect(() => {
    onExpired(() => { setUser(null); void setToken(null); });
    restoreToken().then(async value => { if (value) await refresh(); }).catch(() => { setUser(null); }).finally(() => setLoading(false));
  }, []);
  async function signIn(email: string, password: string) { const result = await api<{ token: string; user: User }>('/auth/login', 'POST', { email: email.trim(), password }); await setToken(result.token); setUser(result.user); }
  async function signOut() { try { await api('/auth/logout', 'POST'); } finally { await setToken(null); setUser(null); } }
  return <Context.Provider value={{ user, loading, signIn, signOut, refresh }}>{children}</Context.Provider>;
}
export const useSession = () => useContext(Context);
