import React, { useCallback } from 'react';
import { Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Trip, User, Report, localDay, monthStart } from '../lib/types';
import { Page, Card, Body, Button, Heading, Loading, Notice, Stats, TripCard, useLoad, colors } from '../components/ui';
export default function Dashboard() {
  const { user } = useSession();
  const loader = useCallback(async () => {
    const [trips, users, report] = await Promise.all([api<Trip[]>('/trips'), user?.role === 'hr' ? api<User[]>('/users') : Promise.resolve([]), user?.role === 'driver' ? api<Report>(`/drivers/${user._id}/summary?from=${monthStart()}&to=${localDay()}`) : Promise.resolve(null)]);
    return { trips, users, report, checkedAt: Date.now() };
  }, [user]);
  const { data, loading, error, refresh } = useLoad(loader);
  const upcoming = data?.trips.filter(t => ['requested', 'assigned', 'in_progress'].includes(t.status)).sort((a,b) => a.startAt.localeCompare(b.startAt)) || [];
  const summary = data?.report?.summary[0];
  const expiring = data?.users.filter(u => u.role === 'driver' && (!u.licenseFile || !u.licenseExpiry || new Date(u.licenseExpiry).getTime() < data.checkedAt + 30 * 86400000)) || [];
  return <Page title={`Hello, ${user?.name.split(' ')[0]}.`} subtitle={user?.role === 'hr' ? 'Your transport desk, at a glance.' : user?.role === 'driver' ? 'Your next journey and your progress, in one place.' : 'Plan a journey. We’ll take care of the driver.'} loading={loading} refresh={() => void refresh()}>
    <Card dark><Text style={{ color: colors.lime, fontSize: 11, letterSpacing: 2 }}>KEEPING YOUR WORKPLACE MOVING</Text><Text style={{ color: 'white', fontSize: 25, fontWeight: '700', marginVertical: 10 }}>{upcoming.length ? `${upcoming.length} journeys on the horizon` : 'Ready for the road ahead'}</Text><Text style={{ color: '#C3D3C4', lineHeight: 21 }}>{user?.role === 'hr' ? 'Review requests, match the right vehicle, and keep every team moving.' : user?.role === 'driver' ? 'Check your assignment before departure and record your odometer for every trip.' : 'Add a pickup, destination and schedule to request your next trip.'}</Text></Card>
    <Notice text={error} error/><Loading show={loading && !data}/>
    {data && <Stats values={user?.role === 'driver' ? [['Km this month', summary?.kilometres || 0], ['Trips this month', summary?.trips || 0], ['Rating / 5', summary?.rating ?? '—']] : [['Requested', data.trips.filter(t => t.status === 'requested').length], ['On the road', data.trips.filter(t => t.status === 'in_progress').length], ['Completed*', data.trips.filter(t => t.status === 'completed').length]]}/>}
    {user?.role === 'department' && <Button title="+ Request a driver" onPress={() => router.push('/trips/new')}/>}
    {user?.role === 'hr' && expiring.length > 0 && <Notice text={`${expiring.length} driver licence(s) missing, expired, or expiring within 30 days. Review them in People.`}/>}
    {user?.role === 'driver' && <Button secondary title={`Availability: ${user.availability} · Update`} onPress={() => router.push('/profile')}/>}
    <Heading>Upcoming journeys</Heading>{upcoming.slice(0, 5).map(trip => <TripCard key={trip._id} trip={trip}/>)}{data && upcoming.length === 0 && <Card><Heading>A clear road ahead</Heading><Body>New requests and assigned journeys will appear here. Pull down to refresh.</Body></Card>}
    <Button secondary title="View all trips →" onPress={() => router.push('/trips')}/>{user?.role !== 'driver' && <Body>*Overview uses the latest 500 trips. Reports include all completed trips in the selected period.</Body>}
  </Page>;
}
