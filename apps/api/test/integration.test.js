import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';
import { createApp } from '../src/app.js';
import { User, Trip, Asset, Report } from '../src/models.js';
import { catchUpMonthlyReports, reportData } from '../src/reports.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.env.JWT_SECRET = 'integration-test-only-secret-not-for-deployment-123456';
process.env.REPORT_TIMEZONE = 'Asia/Colombo';
process.env.MONGOMS_DOWNLOAD_DIR = path.join(root, '.cache/mongodb-binaries');
process.env.MONGOMS_VERSION = '7.0.24';
process.env.TEMP = path.join(root, '.cache/temp'); process.env.TMP = process.env.TEMP;
let db, app, hr, dept, driver, other, tripId;
const password = 'Testing-password-123';
const auth = token => ({ Authorization: 'Bearer ' + token });
const fixture = () => ({ title: 'Client visit', pickup: 'Colombo office', destination: 'Galle office', startAt: new Date(Date.now()+600000).toISOString(), endAt: new Date(Date.now()+7200000).toISOString(), estimatedKm: 220, passengers: 3, vehicleType: 'Car', contactName: 'Travel desk', contactPhone: '0771234567' });
async function login(email) { const response = await request(app).post('/api/v1/auth/login').send({email,password}).expect(200); return response.body; }
before(async () => {
  await mkdir(process.env.TEMP,{recursive:true});
  const { MongoMemoryReplSet } = await import('mongodb-memory-server');
  db = await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'},binary:{downloadDir:process.env.MONGOMS_DOWNLOAD_DIR}});
  await mongoose.connect(db.getUri()); await Promise.all([User.init(),Trip.init(),Asset.init(),Report.init()]); app = createApp();
  await User.create({name:'HR',email:'hr@test.com',passwordHash:await bcrypt.hash(password,10),role:'hr'}); hr = await login('hr@test.com');
  for (const [email,role] of [['dept@test.com','department'],['other@test.com','department'],['driver@test.com','driver']]) {
    await request(app).post('/api/v1/users').set(auth(hr.token)).send({name:email,email,password,role,phone:'0771234567',departmentName:role === 'department' ? 'Finance' : undefined,vehicleType:'Car',vehiclePlate:'CAB-1234',capacity:4,licenseNumber:'L1234',licenseExpiry:'2030-12-31'}).expect(201);
  }
  dept = await login('dept@test.com'); other = await login('other@test.com'); driver = await login('driver@test.com');
});
after(async () => {await mongoose.disconnect();if(db)await db.stop();});
test('role boundaries and invalid requests are enforced',async()=>{
  await request(app).get('/api/v1/users').expect(401);
  await request(app).get('/api/v1/users').set(auth(dept.token)).expect(403);
  await request(app).get('/api/v1/reports/monthly').set(auth(driver.token)).expect(403);
  await request(app).post('/api/v1/trips').set(auth(driver.token)).send(fixture()).expect(403);
  await request(app).post('/api/v1/trips').set(auth(dept.token)).send({...fixture(),estimatedKm:-3}).expect(400);
  await request(app).get('/api/v1/trips/not-an-id').set(auth(dept.token)).expect(400);
});
test('department requests are private and licence upload is required',async()=>{
  const created = await request(app).post('/api/v1/trips').set(auth(dept.token)).send(fixture()).expect(201); tripId=created.body._id;
  await request(app).get('/api/v1/trips/'+tripId).set(auth(other.token)).expect(404);
  await request(app).post(`/api/v1/trips/${tripId}/assign`).set(auth(hr.token)).send({driverId:driver.user._id}).expect(409);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP1sAAAAASUVORK5CYII=','base64');
  await request(app).post(`/api/v1/users/${driver.user._id}/assets/license`).set(auth(hr.token)).attach('file',Buffer.from('fake'),{filename:'fake.pdf',contentType:'application/pdf'}).expect(400);
  const upload = await request(app).post(`/api/v1/users/${driver.user._id}/assets/license`).set(auth(hr.token)).attach('file',png,'license.png').expect(201);
  await request(app).get('/api/v1/assets/'+upload.body.licenseFile).set(auth(dept.token)).expect(403);
  await request(app).get('/api/v1/assets/'+upload.body.licenseFile).set(auth(driver.token)).expect(200);
  const candidates = await request(app).get(`/api/v1/trips/${tripId}/candidates`).set(auth(hr.token)).expect(200); assert.equal(candidates.body.length,1);
});
test('vehicle capacity, availability and licence expiry prevent assignment',async()=>{
  for (const change of [{capacity:1},{availability:'leave'},{licenseExpiry:'2020-01-01'},{vehicleType:'Van'}]) {
    await User.updateOne({_id:driver.user._id},{$set:change});
    await request(app).post(`/api/v1/trips/${tripId}/assign`).set(auth(hr.token)).send({driverId:driver.user._id}).expect(409);
    await User.updateOne({_id:driver.user._id},{$set:{capacity:4,availability:'available',licenseExpiry:'2030-12-31',vehicleType:'Car'}});
  }
});
test('concurrent overlapping assignments allow only one booking',async()=>{
  const second = await request(app).post('/api/v1/trips').set(auth(dept.token)).send(fixture()).expect(201);
  const ids=[tripId,second.body._id];
  const results=await Promise.all(ids.map(i=>request(app).post(`/api/v1/trips/${i}/assign`).set(auth(hr.token)).send({driverId:driver.user._id})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]); tripId=ids[results.findIndex(r=>r.status===200)];
  await request(app).patch('/api/v1/users/'+driver.user._id).set(auth(hr.token)).send({active:false}).expect(409);
});
test('driver completes once, validates odometer and department submits feedback once',async()=>{
  await request(app).post(`/api/v1/trips/${tripId}/start`).set(auth(dept.token)).send({odometer:1000}).expect(403);
  await request(app).post(`/api/v1/trips/${tripId}/start`).set(auth(driver.token)).send({odometer:1000}).expect(200);
  await request(app).post(`/api/v1/trips/${tripId}/decision`).set(auth(hr.token)).send({action:'cancelled',reason:'Too late'}).expect(409);
  await request(app).post(`/api/v1/trips/${tripId}/complete`).set(auth(driver.token)).send({odometer:900}).expect(400);
  const completed=await request(app).post(`/api/v1/trips/${tripId}/complete`).set(auth(driver.token)).send({odometer:1234.5}).expect(200); assert.equal(completed.body.actualKm,234.5);
  await request(app).post(`/api/v1/trips/${tripId}/complete`).set(auth(driver.token)).send({odometer:1500}).expect(409);
  await request(app).post(`/api/v1/trips/${tripId}/feedback`).set(auth(other.token)).send({rating:5}).expect(409);
  await request(app).post(`/api/v1/trips/${tripId}/feedback`).set(auth(dept.token)).send({rating:6}).expect(400);
  await request(app).post(`/api/v1/trips/${tripId}/feedback`).set(auth(dept.token)).send({rating:5,comment:'=HYPERLINK("https://example.com")'}).expect(200);
  await request(app).post(`/api/v1/trips/${tripId}/feedback`).set(auth(dept.token)).send({rating:1}).expect(409);
});
test('Excel totals, string safety, and custom date validation',async()=>{
  const today=DateTime.now().setZone('Asia/Colombo').toISODate();
  const url=`/api/v1/reports/custom?from=${today}&to=${today}`;
  const json=await request(app).get(url).set(auth(hr.token)).expect(200);
  assert.equal(json.body.summary[0].kilometres,234.5); assert.equal(json.body.summary[0].rating,5);
  const xlsx=await request(app).get(url+'&format=xlsx').set(auth(hr.token)).buffer(true).parse((res,cb)=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>cb(null,Buffer.concat(chunks)));}).expect(200);
  const book=new ExcelJS.Workbook();await book.xlsx.load(xlsx.body);assert.equal(book.worksheets.length,3);assert.equal(book.getWorksheet('Driver summary').getCell('E2').value,234.5);assert.equal(typeof book.getWorksheet('Trip details').getCell('N2').value,'string');
  await request(app).get('/api/v1/reports/custom?from=2026-02-30&to=2026-03-01').set(auth(hr.token)).expect(400);
});
test('month-close catch-up uses Colombo boundaries and snapshots are idempotent',async()=>{
  const completed=await Trip.findById(tripId).lean(); delete completed._id; delete completed.__v;
  await Trip.create({...completed,completedAt:new Date('2026-08-31T18:29:59Z'),actualKm:10});
  await Trip.create({...completed,completedAt:new Date('2026-08-31T18:30:00Z'),actualKm:20});
  const data=await reportData('2026-08-01','2026-08-31');assert.equal(data.summary[0].kilometres,10);
  await catchUpMonthlyReports(DateTime.fromISO('2026-10-01',{zone:'Asia/Colombo'}));
  const count=await Report.countDocuments();await catchUpMonthlyReports(DateTime.fromISO('2026-10-01',{zone:'Asia/Colombo'}));assert.equal(await Report.countDocuments(),count);
  const august=await Report.findOne({month:'2026-08'});assert.equal(august.summary[0].kilometres,10);
});
test('password reset invalidates existing tokens and hides password hashes',async()=>{
  const response=await request(app).get('/api/v1/users').set(auth(hr.token)).expect(200);assert.ok(response.body.every(u=>!u.passwordHash));
  await request(app).patch('/api/v1/users/'+other.user._id).set(auth(hr.token)).send({password:'New-password-1234'}).expect(200);
  await request(app).get('/api/v1/me').set(auth(other.token)).expect(401);
});
