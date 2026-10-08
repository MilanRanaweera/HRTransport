import React from 'react';
import { router } from 'expo-router';
import { Page } from '../../components/ui';
import { AccountForm } from '../../components/AccountForm';
export default function NewAccount() { return <Page back title="Grow your team" subtitle="Create an account, then share the login details with the person securely. Drivers need a licence document before assignment."><AccountForm onSaved={u => router.replace(`/people/${u._id}`)}/></Page>; }
