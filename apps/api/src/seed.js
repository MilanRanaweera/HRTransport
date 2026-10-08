import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from './models.js';
const email = z.email().toLowerCase().parse(process.env.SEED_HR_EMAIL);
const password = z.string().min(10).parse(process.env.SEED_HR_PASSWORD);
if (password.startsWith('replace-')) throw new Error('Set a real SEED_HR_PASSWORD in .env');
await mongoose.connect(process.env.MONGODB_URI);
await User.init();
if (await User.exists({ email })) console.log('Account already exists; no changes made.');
else { await User.create({ name: process.env.SEED_HR_NAME || 'HR Administrator', email, passwordHash: await bcrypt.hash(password, 12), role: 'hr', phone: process.env.HR_PHONE }); console.log('HR account created. Sign in with the credentials you configured.'); }
await mongoose.disconnect();
