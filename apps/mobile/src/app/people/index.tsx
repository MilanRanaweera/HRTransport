import React, { useCallback, useState } from 'react';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { User } from '../../lib/types';
import { Page, Button, Field, Choices, Card, Heading, Body, Badge, Loading, Notice, useLoad } from '../../components/ui';
export default function People() {
  const [filter,setFilter] = useState('driver'); const [search,setSearch] = useState('');
  const {data,loading,error,refresh} = useLoad(useCallback(() => api<User[]>('/users'), []));
  return <Page title="Your people" subtitle="The teams and drivers behind every journey." loading={loading} refresh={() => void refresh()}><Button title="+ Add driver or sub-department" onPress={() => router.push('/people/new')}/><Field label="Search accounts" value={search} onChangeText={setSearch} placeholder="Name, department or vehicle"/><Choices label="Account type" value={filter} options={['driver','department']} onChange={setFilter}/><Notice text={error} error/><Loading show={loading && !data}/>{data?.filter(u => u.role === filter && `${u.name} ${u.departmentName || ''} ${u.vehiclePlate || ''}`.toLowerCase().includes(search.toLowerCase())).map(u => <Card key={u._id}><Badge status={!u.active ? 'inactive' : u.role === 'driver' ? u.availability || 'available' : 'active'}/><Heading>{u.name}</Heading><Body>{u.role === 'driver' ? `${u.vehicleType} · ${u.vehiclePlate} · ${u.capacity} passengers` : u.departmentName}{'\n'}{u.email}</Body>{u.role === 'driver' && <Body>Licence expires: {u.licenseExpiry || 'Not set'} · {u.licenseFile ? 'Document uploaded' : 'Document missing'}</Body>}<Button secondary title="View details →" onPress={() => router.push(`/people/${u._id}`)}/></Card>)}{data?.length === 0 && <Body>Add your first driver or sub-department to get started.</Body>}</Page>;
}
