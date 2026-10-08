import React, { useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { useSession } from '../../lib/session';
import { localDay, vehicles } from '../../lib/types';
import { Page, Card, Heading, Field, Choices, Button, Notice, message } from '../../components/ui';
export default function NewTrip() {
  const { user } = useSession(); const [tomorrow] = useState(() => localDay(new Date(Date.now() + 86400000)));
  const [form, setForm] = useState({ title: '', pickup: '', destination: '', stops: '', start: tomorrow + ' 09:00', end: tomorrow + ' 17:00', estimatedKm: '', passengers: '1', vehicleType: 'Car', contactName: user?.name || '', contactPhone: user?.phone || '', notes: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const field = (key: keyof typeof form, label: string, numeric = false) => <Field key={key} label={label} value={form[key]} onChangeText={v => setForm({ ...form, [key]: v })} keyboardType={numeric ? 'decimal-pad' : 'default'}/>;
  async function save() {
    setBusy(true); setError(''); try {
      const parse = (value: string) => { if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) throw new Error('Enter date and time as YYYY-MM-DD HH:mm'); const d = new Date(value.replace(' ', 'T') + ':00'); if (isNaN(d.getTime()) || localDay(d) !== value.slice(0,10)) throw new Error('Enter a valid calendar date'); return d.toISOString(); };
      const result = await api<{ _id: string }>('/trips', 'POST', { ...form, startAt: parse(form.start), endAt: parse(form.end), estimatedKm: Number(form.estimatedKm), passengers: Number(form.passengers) }); router.replace(`/trips/${result._id}`);
    } catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <Page back title="Request a driver" subtitle="Tell HR where you need to go and when."><Card><Heading>The journey</Heading>{field('title','Task / purpose')}{field('pickup','Pickup address')}{field('destination','Destination address')}{field('stops','Other stops (optional)')}{field('start','Departure · YYYY-MM-DD HH:mm (device local time)')}{field('end','Expected return · YYYY-MM-DD HH:mm (device local time)')}{field('estimatedKm','Estimated total kilometres',true)}<Notice text="Enter your estimated route distance, including the return journey if needed. Actual distance is calculated from the driver’s odometer."/></Card><Card><Heading>Vehicle & passengers</Heading><Choices label="Vehicle type" value={form.vehicleType} options={vehicles} onChange={v => setForm({ ...form, vehicleType: v })}/>{field('passengers','Passengers (excluding driver)',true)}{field('contactName','Contact person')}{field('contactPhone','Contact phone')}<Field label="Notes / accessibility / cargo needs" value={form.notes} onChangeText={v => setForm({ ...form, notes: v })} multiline/></Card><Notice text={error} error/><Button title={busy ? 'Submitting…' : 'Send request to HR →'} disabled={busy} onPress={() => void save()}/></Page>;
}
