import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api/v1';
let token: string | null = null;
let expired: (() => void) | undefined;
export function onExpired(callback: () => void) { expired = callback; }
export function authHeaders(): Record<string, string> { return token ? { Authorization: `Bearer ${token}` } : {}; }
export async function setToken(value: string | null) {
  token = value;
  if (Platform.OS === 'web') { if (value) sessionStorage.setItem('hr-session', value); else sessionStorage.removeItem('hr-session'); }
  else if (value) await SecureStore.setItemAsync('hr-session', value);
  else await SecureStore.deleteItemAsync('hr-session');
}
export async function restoreToken() { token = Platform.OS === 'web' ? sessionStorage.getItem('hr-session') : await SecureStore.getItemAsync('hr-session'); return token; }
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const form = body instanceof FormData;
    const response = await fetch(API_URL + path, { method, signal: controller.signal, headers: { ...authHeaders(), ...(!form && body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? form ? body : JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401 && path !== '/auth/login') expired?.(); throw new Error(data.error || 'Request failed'); }
    return data as T;
  } catch (error) {
    if (error instanceof Error && (error.name === 'AbortError' || error.message === 'Network request failed' || error.message === 'Failed to fetch')) throw new Error('Cannot reach HR Transport. Check your connection and the API address in apps/mobile/.env.');
    throw error;
  } finally { clearTimeout(timer); }
}
export async function uploadFile(userId: string, kind: 'photo' | 'license', file: { uri: string; name?: string; mimeType?: string }) {
  const form = new FormData();
  const name = file.name || 'photo.jpg';
  let blob: Blob;
  if (Platform.OS === 'web') blob = await (await fetch(file.uri)).blob();
  else {
    // Expo's fetch requires real file bytes, not React Native's { uri, name, type } descriptor.
    const localFile = new File(file.uri);
    if (localFile.size > 5 * 1024 * 1024) throw new Error('Choose a file no larger than 5 MB.');
    // Pass Expo's File directly: it implements bytes(), which Expo fetch supports.
    // React Native's global Blob cannot be constructed from ArrayBuffer data.
    blob = localFile;
  }
  if (blob.size > 5 * 1024 * 1024) throw new Error('Choose a file no larger than 5 MB.');
  form.append('file', blob, name);
  return api('/users/' + userId + '/assets/' + kind, 'POST', form);
}
export async function download(path: string, filename: string, mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  if (Platform.OS === 'web') {
    const response = await fetch(API_URL + path, { headers: authHeaders() });
    if (!response.ok) throw new Error((await response.json()).error || 'Download failed');
    const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    if (!FileSystem.cacheDirectory) throw new Error('File storage is unavailable on this device.');
    // Expo Go's scoped cache may not exist yet on a fresh app session.
    const directory = `${FileSystem.cacheDirectory}exports/${Date.now()}-${Math.random().toString(36).slice(2)}/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const dest = directory + filename;
    try {
      const result = await FileSystem.downloadAsync(API_URL + path, dest, { headers: authHeaders() });
      if (result.status !== 200) throw new Error('Download failed. Refresh your session and try again.');
      if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device');
      await Sharing.shareAsync(result.uri, { mimeType: mime, dialogTitle: 'Save or share HR Transport file' });
    } catch (error) {
      await FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => {});
      throw error;
    }
    // Android can resolve sharing before the receiving app reads the file.
    // Leave successful exports in the disposable cache for that handoff.
  }
}
export async function downloadAsset(id: string) {
  const meta = await api<{name: string; mime: string}>(`/assets/${id}?metadata=true`);
  await download('/assets/' + id, meta.name, meta.mime);
}
