import React, { useState } from 'react';
import { api } from '../lib/api';
import { User, vehicles } from '../lib/types';
import { Button, Card, Choices, Field, Heading, Notice, message } from './ui';
export function AccountForm({ user, onSaved }: { user?: User; onSaved: (u: User) => void }) {
  const [role, setRole] = useState(user?.role || 'driver');
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '', password: '', phone: user?.phone || '', departmentName: user?.departmentName || '', vehicleType: user?.vehicleType || 'Car', vehiclePlate: user?.vehiclePlate || '', capacity: String(user?.capacity || 4), licenseNumber: user?.licenseNumber || '', licenseExpiry: user?.licenseExpiry || '', notes: user?.notes || '' });
  const [busy,setBusy] = useState(false); const [error,setError] = useState('');
  const field = (key: keyof typeof form, label: string) => <Field key={key} label={label} value={form[key]} onChangeText={v => setForm({ ...form, [key]: v })} secureTextEntry={key === 'password'} autoCapitalize={['email','password'].includes(key) ? 'none' : 'sentences'} keyboardType={key === 'email' ? 'email-address' : key === 'capacity' ? 'number-pad' : 'default'}/>;
  async function save() {
    setBusy(true); setError(''); try {
      const common = { name: form.name, phone: form.phone, notes: form.notes, ...(form.password ? {password:form.password}:{}), ...(role === 'department' ? { departmentName: form.departmentName } : { vehicleType: form.vehicleType, vehiclePlate: form.vehiclePlate, capacity: Number(form.capacity), licenseNumber: form.licenseNumber, licenseExpiry: form.licenseExpiry }) };
      // Only changed fields are sent while editing so unrelated edits do not block on active trips.
      const body = user ? Object.fromEntries(Object.entries(common).filter(([key,value]) => value !== user[key as keyof User])) : { ...common, role, email: form.email };
      onSaved(await api<User>(user ? '/users/' + user._id : '/users', user ? 'PATCH' : 'POST', body));
    } catch(e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <><Card><Heading>{user ? 'Account details' : 'Create an account'}</Heading>{!user && <Choices label="Account type" value={role} options={['driver','department']} onChange={v => setRole(v as 'driver' | 'department')}/>}{field('name','Full name / account name')}{!user && field('email','Login email')}{field('password',user ? 'Reset password (optional, 10+ characters)' : 'Initial password (10+ characters)')}{field('phone','Phone number')}{role === 'department' && field('departmentName','Sub-department name')}{role === 'driver' && <><Choices label="Vehicle type" value={form.vehicleType} options={vehicles} onChange={v => setForm({...form,vehicleType:v})}/>{field('vehiclePlate','Vehicle registration')}{field('capacity','Passenger capacity (excluding driver)')}{field('licenseNumber','Driving licence number')}{field('licenseExpiry','Licence expiry · YYYY-MM-DD')}</>}<Field label="Important notes" value={form.notes} onChangeText={v => setForm({...form,notes:v})} multiline/><Notice text={error} error/><Button title={busy ? 'Saving…' : user ? 'Save changes' : 'Create account'} disabled={busy} onPress={() => void save()}/></Card></>;
}
