import React, { useEffect, useState } from 'react';
import { Image, Platform } from 'react-native';
import { API_URL, authHeaders } from '../lib/api';
export function PrivatePhoto({ id }: { id: string }) {
  const [uri, setUri] = useState<string>();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    let cancelled = false; let objectUrl: string | undefined;
    fetch(API_URL + '/assets/' + id, { headers: authHeaders() })
      .then(async response => { if (!response.ok) return; const blob = await response.blob(); if (!cancelled) { objectUrl = URL.createObjectURL(blob); setUri(objectUrl); } })
      .catch(() => { /* The profile remains usable if a photo cannot load. */ });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);
  if (Platform.OS === 'web' && !uri) return null;
  return <Image accessibilityLabel="Profile photo" source={Platform.OS === 'web' ? { uri } : { uri: API_URL + '/assets/' + id, headers: authHeaders() }} style={{ width: 96, height: 96, borderRadius: 48, alignSelf: 'center' }}/>;
}
