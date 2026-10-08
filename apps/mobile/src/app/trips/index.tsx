import React, { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { Trip } from '../../lib/types';
import { useSession } from '../../lib/session';
import { Page, Button, Choices, Field, Notice, Loading, TripCard, Body, useLoad } from '../../components/ui';
export default function Trips() {
  const { user } = useSession(); const [filter, setFilter] = useState('all'); const [search, setSearch] = useState('');
  const { data, loading, error, refresh } = useLoad(useCallback(() => api<Trip[]>('/trips'), []));
  const shown = data?.filter(t => (filter === 'all' || t.status === filter) && `${t.title} ${t.pickup} ${t.destination} ${t.driver?.name || ''}`.toLowerCase().includes(search.toLowerCase())) || [];
  return <Page title="Journeys" subtitle="From the first request to the final kilometre." refresh={() => void refresh()} loading={loading}>
    {user?.role === 'department' && <Button title="+ New trip request" onPress={() => router.push('/trips/new')}/>}<Field label="Find a journey" value={search} onChangeText={setSearch} placeholder="Task, location or driver"/><Choices label="Status" value={filter} onChange={setFilter} options={['all','requested','assigned','in_progress','completed','cancelled','rejected']}/><Notice text={error} error/><Loading show={loading && !data}/>{shown.map(t => <TripCard key={t._id} trip={t}/>)}{!loading && shown.length === 0 && <Body>No journeys match this view.</Body>}<Body>Showing up to 500 most recent trips. Use reports for full historical totals.</Body>
  </Page>;
}
