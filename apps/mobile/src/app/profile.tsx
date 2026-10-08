import React, { useCallback, useState } from 'react';
import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, uploadFile } from '../lib/api';
import { PrivatePhoto } from '../components/PrivatePhoto';
import { useSession } from '../lib/session';
import { Page, Card, Heading, Body, Field, Choices, Button, Notice, useLoad, message } from '../components/ui';
export default function Profile() {
  const {user,refresh,signOut} = useSession(); const [name,setName] = useState(user?.name || ''); const [phone,setPhone] = useState(user?.phone || ''); const [availability,setAvailability] = useState(user?.availability || 'available'); const [currentPassword,setCurrent] = useState(''); const [newPassword,setNew] = useState(''); const [error,setError] = useState(''); const [notice,setNotice] = useState(''); const [busy,setBusy] = useState(false);
  const contacts = useLoad(useCallback(() => api<{hr:string;emergency:string}>('/contacts'),[]));
  async function run(fn:()=>Promise<unknown>,success='Saved.') {setBusy(true);setError('');setNotice('');try{await fn();setNotice(success);}catch(e){setError(message(e));}finally{setBusy(false);}}
  async function photo() {
    const result = await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.8});
    if (!result.canceled && user) { const asset = result.assets[0]; await uploadFile(user._id,'photo',{uri:asset.uri,name:asset.fileName || 'photo.jpg',mimeType:asset.mimeType || 'image/jpeg'}); await refresh(); }
  }
  return <Page title="Your profile" subtitle="Keep your details up to date and stay connected."><Notice text={error || contacts.error} error/><Notice text={notice}/><Card>{user?.photo && <PrivatePhoto key={user.photo} id={user.photo}/>}<Heading>{user?.name}</Heading><Body>{user?.email}</Body><Button secondary title="Change profile photo" disabled={busy} onPress={() => void run(photo,'Photo updated.')}/><Field label="Name" value={name} onChangeText={setName}/><Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/>{user?.role === 'driver' && <><Choices label="Availability" value={availability} options={['available','unavailable','leave']} onChange={setAvailability}/><Body>Changing availability prevents new assignments. Existing trips remain assigned; contact HR if you cannot attend.</Body><Body>{user.vehicleType} · {user.vehiclePlate}{'\n'}Licence expires: {user.licenseExpiry}{'\n'}{user.notes}</Body></>}<Button title="Save profile" disabled={busy} onPress={() => void run(async () => {await api('/me','PATCH',{name,phone,...(user?.role === 'driver' ? {availability}: {})});await refresh();})}/></Card>
    <Card><Heading>Essential contacts</Heading><Body>HR transport desk: {contacts.data?.hr || 'Not configured'}{'\n'}Emergency: {contacts.data?.emergency || 'Not configured'}</Body>{contacts.data?.hr && <Button secondary title="Call HR transport desk" onPress={() => void run(() => Linking.openURL('tel:'+contacts.data?.hr),'')}/>}{contacts.data?.emergency && <Button secondary title="Call emergency number" onPress={() => void run(() => Linking.openURL('tel:'+contacts.data?.emergency),'')}/>}</Card>
    <Card><Heading>Change password</Heading><Field label="Current password" value={currentPassword} onChangeText={setCurrent} secureTextEntry/><Field label="New password (10+ characters)" value={newPassword} onChangeText={setNew} secureTextEntry/><Button secondary title="Change password & sign out" disabled={busy || !currentPassword || newPassword.length < 10} onPress={() => void run(async () => {await api('/auth/password','POST',{currentPassword,newPassword});await signOut();},'')}/></Card><Button secondary title="Sign out" onPress={() => void run(signOut,'')} disabled={busy}/>
  </Page>;
}


