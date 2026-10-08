import mongoose from 'mongoose';
import { DateTime } from 'luxon';
import { createApp } from './app.js';
import { catchUpMonthlyReports } from './reports.js';
import { zone } from './domain.js';
if (!DateTime.now().setZone(zone()).isValid) throw new Error('REPORT_TIMEZONE must be a valid IANA timezone');
const app = createApp();
await mongoose.connect(process.env.MONGODB_URI);
await Promise.all(Object.values(mongoose.models).map(model => model.init()));
const hello = await mongoose.connection.db.admin().command({ hello: 1 });
if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB must run as a replica set (see README) or use MongoDB Atlas');
const server = app.listen(Number(process.env.PORT || 4000), '0.0.0.0', () => console.log(`HR Transport API listening on port ${process.env.PORT || 4000}`));
const runReports = () => catchUpMonthlyReports().catch(error => console.error('Monthly report job failed:', error.message));
await runReports();
const timer = setInterval(runReports, 60 * 60 * 1000);
async function stop() { clearInterval(timer); server.close(); await mongoose.disconnect(); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
