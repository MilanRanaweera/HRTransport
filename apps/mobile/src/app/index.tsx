import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSession } from '../lib/session';
import { Page, Card, Field, Button, Notice, colors, message } from '../components/ui';
export default function Login() {
  const { signIn } = useSession(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit() { setBusy(true); setError(''); try { await signIn(email, password); router.replace('/dashboard'); } catch (e) { setError(message(e)); } finally { setBusy(false); } }
  return <Page title={'Every journey,\nwell organised.'} subtitle="Your people. Your vehicles. One connected workplace.">
    <Card dark><View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, paddingVertical: 15 }}><Feather name="navigation" size={45} color={colors.lime}/><View style={{ flex: 1 }}><Text style={{ color: colors.lime, fontSize: 11, letterSpacing: 2 }}>HR TRANSPORT</Text><Text style={{ color: 'white', fontSize: 22, fontWeight: '600', marginTop: 9 }}>A smoother day starts here.</Text></View></View></Card>
    <Card><Text style={{ color: colors.green, fontSize: 24, fontWeight: '700', marginBottom: 12 }}>Welcome back</Text><Field label="Work email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@company.com"/><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" onSubmitEditing={() => void submit()}/><Notice text={error} error/><Button title={busy ? 'Signing in…' : 'Sign in →'} onPress={() => void submit()} disabled={busy || !email || !password}/><Text style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}>One sign-in for HR, sub-departments and drivers. Your HR administrator creates your account and can reset your password.</Text></Card>
  </Page>;
}

