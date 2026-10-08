import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '../lib/session';
import { Loading } from '../components/ui';
function Routes() {
  const { user, loading } = useSession(); if (loading) return <Loading show/>;
  return <><StatusBar style="dark"/><Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={!user}><Stack.Screen name="index"/></Stack.Protected>
    <Stack.Protected guard={!!user}><Stack.Screen name="dashboard"/><Stack.Screen name="trips/index"/><Stack.Screen name="trips/[id]"/><Stack.Screen name="profile"/></Stack.Protected>
    <Stack.Protected guard={user?.role === 'department'}><Stack.Screen name="trips/new"/></Stack.Protected>
    <Stack.Protected guard={user?.role === 'hr'}><Stack.Screen name="people/index"/><Stack.Screen name="people/[id]"/><Stack.Screen name="people/new"/><Stack.Screen name="reports"/></Stack.Protected>
  </Stack></>;
}
export default function Layout() { return <SessionProvider><Routes/></SessionProvider>; }
