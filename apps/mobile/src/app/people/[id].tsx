import React, { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { api, download, downloadAsset, uploadFile } from '../../lib/api';
import { User, Report, monthStart, localDay } from '../../lib/types';
import { Page, Button, Card, Heading, Body, Notice, Loading, Stats, useLoad, message } from '../../components/ui';
import { AccountForm } from '../../components/AccountForm';
export default function Person() {
  const {id} = useLocalSearchParams<{id:string}>(); const [error,setError] = useState(''); const [notice,setNotice] = useState(''); const [busy,setBusy] = useState(false);
  const {data,loading,error:loadError,refresh} = useLoad(useCallback(async () => {
    const users = await api<User[]>('/users'); const user = users.find(u => u._id === id); if (!user) throw new Error('Account not found');
    const report = user.role === 'driver' ? await api<Report>(`/drivers/${id}/summary?from=${monthStart()}&to=${localDay()}`) : null; return {user,report};
  },[id]));
  async function perform(fn: () => Promise<unknown>, success: string) { setBusy(true); setError(''); setNotice(''); try { await fn(); setNotice(success); await refresh(); } catch(e) { setError(message(e)); } finally { setBusy(false); } }
  async function upload() {
    if (Platform.OS === 'android') {
      // Use the system picker through the same File API that reads the upload.
      // DocumentPicker's shared cache is outside Expo Go's scoped File permissions.
      const result = await File.pickFileAsync({ mimeTypes: ['image/jpeg', 'image/png', 'application/pdf'] });
      if (!result.canceled) await uploadFile(id, 'license', { uri: result.result.uri, name: result.result.name, mimeType: result.result.type });
      return;
    }
    const result = await DocumentPicker.getDocumentAsync({type:['image/jpeg','image/png','application/pdf'],copyToCacheDirectory:true});
    if (!result.canceled) await uploadFile(id,'license',result.assets[0]);
  }
  const stat = data?.report?.summary[0];
  return <Page back title={data?.user.name || 'Account details'} subtitle="Account, documents and monthly performance." loading={loading} refresh={() => void refresh()}><Notice text={error || loadError} error/><Notice text={notice}/><Loading show={loading && !data}/>{data && <>
    {data.user.role === 'driver' && <><Card><Heading>This month</Heading><Stats values={[[ 'Actual km',stat?.kilometres || 0],['Completed trips',stat?.trips || 0],['Rating / 5',stat?.rating ?? '—']]}/><Body>{stat?.locations || 'No completed journeys this month.'}</Body><Button secondary title="Download this driver’s month-to-date Excel" disabled={busy} onPress={() => void perform(() => download(`/reports/custom?from=${monthStart()}&to=${localDay()}&driverId=${id}&format=xlsx`,'driver-report.xlsx'),'Report downloaded.')}/></Card><Card><Heading>Driving licence</Heading><Body>Expiry: {data.user.licenseExpiry}{'\n'}{data.user.licenseFile ? 'Document on file' : 'Upload required before assigning trips'}</Body><Button title="Upload / replace licence" disabled={busy} onPress={() => void perform(upload,'Licence document updated.')}/>{data.user.licenseFile && <Button secondary title="Open / save licence document" disabled={busy} onPress={() => void perform(() => downloadAsset(data.user.licenseFile!),'Document downloaded.')}/>}<Body>JPEG, PNG or PDF · Maximum 5 MB. Enter and verify the expiry date below; it is not extracted automatically.</Body></Card></>}
    <AccountForm key={JSON.stringify(data.user)} user={data.user} onSaved={() => {setNotice('Account saved.'); void refresh();}}/>
    <Button secondary title={data.user.active ? 'Deactivate account' : 'Reactivate account'} disabled={busy} onPress={() => void perform(() => api('/users/'+id,'PATCH',{active:!data.user.active}),'Account status updated.')}/><Body>Deactivation preserves trip history and prevents sign-in. Active assignments must be completed or cancelled first.</Body>
  </>}</Page>;
}

