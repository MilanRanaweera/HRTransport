import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { z } from 'zod';
import { DateTime } from 'luxon';
import { User, Trip, Asset, Report, publicUser } from './models.js';
import { accountSchema, tripSchema, fail, validLicense, vehicles, text, note, phone, day, zone } from './domain.js';
import { reportData, workbook, catchUpMonthlyReports } from './reports.js';

const id = value => z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record ID').parse(value);
const roles = (...allowed) => (req, res, next) => allowed.includes(req.user.role) ? next() : next(Object.assign(new Error('Access denied'), { status: 403 }));
const activeStates = ['assigned', 'in_progress'];
const populate = query => query.populate('driver', 'name phone vehicleType vehiclePlate photo').populate('department', 'name departmentName phone');
const history = (trip, user, status, message = '') => { trip.status = status; trip.history.push({ status, actor: user._id, at: new Date(), note: message }); };
const scope = user => user.role === 'hr' ? {} : { [user.role === 'driver' ? 'driver' : 'department']: user._id };

export function createApp() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('replace-')) throw new Error('Set JWT_SECRET to a random secret of at least 32 characters');
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || (process.env.CORS_ORIGINS || 'http://localhost:8081').split(',').includes(origin)) }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ ok: mongoose.connection.readyState === 1, version: '1.0.0' }));
  const api = express.Router(); app.use('/api/v1', api);
  api.post('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many login attempts. Try again in 15 minutes.' } }), async (req, res) => {
    const { email, password } = z.object({ email: z.email().toLowerCase(), password: z.string().max(100) }).parse(req.body);
    const user = await User.findOne({ email, active: true }).select('+passwordHash');
    if (!user || !await bcrypt.compare(password, user.passwordHash)) fail(401, 'Email or password is incorrect');
    const token = jwt.sign({ sub: String(user._id), ver: user.tokenVersion }, process.env.JWT_SECRET, { expiresIn: '12h', issuer: 'hr-transport', audience: 'hr-transport-mobile' });
    res.json({ token, user: publicUser(user) });
  });
  api.use(async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      const payload = jwt.verify(token || '', process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'hr-transport', audience: 'hr-transport-mobile' });
      req.user = await User.findOne({ _id: payload.sub, active: true, tokenVersion: payload.ver });
      if (!req.user) fail(401, 'Please sign in again');
      next();
    } catch { next(Object.assign(new Error('Session expired. Please sign in again.'), { status: 401 })); }
  });
  api.get('/me', (req, res) => res.json(publicUser(req.user)));
  api.get('/contacts', (req, res) => res.json({ hr: process.env.HR_PHONE || '', emergency: process.env.EMERGENCY_PHONE || '' }));
  api.post('/auth/logout', async (req, res) => { await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } }); res.json({ ok: true }); });
  api.patch('/me', async (req, res) => {
    const update = z.object({ name: text.optional(), phone: phone.optional(), availability: z.enum(['available', 'unavailable', 'leave']).optional() }).parse(req.body);
    if (update.availability && req.user.role !== 'driver') fail(403, 'Only drivers can change availability');
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update, $inc: { allocationVersion: 1 } }, { returnDocument: 'after' });
    res.json(publicUser(user));
  });
  api.post('/auth/password', async (req, res) => {
    const body = z.object({ currentPassword: z.string().max(100), newPassword: z.string().min(10).max(100) }).parse(req.body);
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!await bcrypt.compare(body.currentPassword, user.passwordHash)) fail(400, 'Current password is incorrect');
    user.passwordHash = await bcrypt.hash(body.newPassword, 12); user.tokenVersion += 1; await user.save();
    res.json({ ok: true });
  });
  api.get('/users', roles('hr'), async (req, res) => res.json((await User.find({ role: { $in: ['driver', 'department'] } }).sort({ name: 1 })).map(publicUser)));
  api.post('/users', roles('hr'), async (req, res) => {
    const { password, ...data } = accountSchema.parse(req.body);
    const user = await User.create({ ...data, passwordHash: await bcrypt.hash(password, 12) });
    res.status(201).json(publicUser(user));
  });
  api.patch('/users/:id', roles('hr'), async (req, res) => {
    const data = z.object({ name: text.optional(), phone: phone.optional(), departmentName: text.optional(),
      active: z.boolean().optional(), vehicleType: z.enum(vehicles).optional(), vehiclePlate: text.optional(), capacity: z.number().int().min(1).max(100).optional(),
      licenseNumber: text.optional(), licenseExpiry: day.optional(), notes: note.optional(), password: z.string().min(10).max(100).optional() }).parse(req.body);
    const userId = id(req.params.id);
    if (data.password) { data.passwordHash = await bcrypt.hash(data.password, 12); delete data.password; }
    await mongoose.connection.transaction(async session => {
      const user = await User.findOneAndUpdate({ _id: userId, role: { $ne: 'hr' } }, { $inc: { allocationVersion: 1 } }, { returnDocument: 'after', session });
      if (!user) fail(404, 'Account not found');
      const critical = ['active', 'vehicleType', 'vehiclePlate', 'capacity', 'licenseExpiry'];
      if (critical.some(key => key in data) && await Trip.exists({ $or: [{ driver: user._id }, { department: user._id }], status: { $in: activeStates } }).session(session)) fail(409, 'Finish or cancel assigned trips before changing account status, vehicle, or licence expiry');
      Object.assign(user, data); if (data.passwordHash || data.active === false) user.tokenVersion += 1;
      await user.save({ session });
    });
    res.json(publicUser(await User.findById(userId)));
  });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0 } });
  api.post('/users/:id/assets/:kind', upload.single('file'), async (req, res) => {
    const userId = id(req.params.id); const kind = z.enum(['photo', 'license']).parse(req.params.kind);
    if (req.user.role !== 'hr' && (String(req.user._id) !== userId || kind !== 'photo')) fail(403, 'Access denied');
    const user = await User.findById(userId); if (!user) fail(404, 'Account not found');
    if (kind === 'license' && user.role !== 'driver') fail(400, 'Only drivers have a licence');
    if (!req.file) fail(400, 'Choose a file');
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || !(kind === 'photo' ? ['image/jpeg', 'image/png'] : ['image/jpeg', 'image/png', 'application/pdf']).includes(type.mime)) fail(400, 'Choose a JPEG, PNG, or licence PDF, up to 5 MB');
    await mongoose.connection.transaction(async session => {
      const [asset] = await Asset.create([{ owner: userId, kind, name: kind + '.' + type.ext, mime: type.mime, data: req.file.buffer }], { session });
      const key = kind === 'license' ? 'licenseFile' : 'photo';
      const previous = await User.findByIdAndUpdate(userId, { $set: { [key]: asset._id }, $inc: { allocationVersion: 1 } }, { session });
      if (previous[key]) await Asset.deleteOne({ _id: previous[key] }, { session });
    });
    res.status(201).json(publicUser(await User.findById(userId)));
  });
  api.get('/assets/:id', async (req, res) => {
    const asset = await Asset.findById(id(req.params.id)).select('+data');
    if (!asset) fail(404, 'File not found');
    if (req.user.role !== 'hr' && String(asset.owner) !== String(req.user._id)) fail(403, 'Access denied');
    res.set('Cache-Control', 'private, no-store');
    if (req.query.metadata === 'true') return res.json({ name: asset.name, mime: asset.mime });
    res.type(asset.mime).send(asset.data);
  });
  api.get('/trips', async (req, res) => res.json(await populate(Trip.find(scope(req.user)).sort({ createdAt: -1 }).limit(500))));
  api.get('/trips/:id', async (req, res) => {
    const trip = await populate(Trip.findOne({ _id: id(req.params.id), ...scope(req.user) }));
    if (!trip) fail(404, 'Trip not found'); res.json(trip);
  });
  api.post('/trips', roles('department'), async (req, res) => {
    const data = tripSchema.parse(req.body);
    const trip = await Trip.create({ ...data, department: req.user._id, history: [{ status: 'requested', actor: req.user._id, at: new Date() }] });
    res.status(201).json(trip);
  });
  api.get('/trips/:id/candidates', roles('hr'), async (req, res) => {
    const trip = await Trip.findById(id(req.params.id)); if (!trip) fail(404, 'Trip not found');
    const blocked = await Trip.find({ status: { $in: activeStates }, $or: [{ startAt: { $lt: trip.endAt }, endAt: { $gt: trip.startAt } }, { status: 'in_progress' }] }).distinct('driver');
    const drivers = await User.find({ role: 'driver', active: true, availability: 'available', vehicleType: trip.vehicleType, capacity: { $gte: trip.passengers }, _id: { $nin: blocked } });
    res.json(drivers.filter(d => validLicense(d, trip.endAt)).map(publicUser));
  });
  api.post('/trips/:id/assign', roles('hr'), async (req, res) => {
    const driverId = id(req.body.driverId); const tripId = id(req.params.id);
    await mongoose.connection.transaction(async session => {
      // Writing the driver record serializes competing bookings across API instances.
      const driver = await User.findOneAndUpdate({ _id: driverId, role: 'driver', active: true, availability: 'available' }, { $inc: { allocationVersion: 1 } }, { returnDocument: 'after', session });
      if (!driver) fail(409, 'Driver is not available');
      const trip = await Trip.findById(tripId).session(session);
      if (!trip || trip.status !== 'requested') fail(409, 'Only requested trips can be assigned');
      if (trip.startAt <= new Date()) fail(409, 'Departure has passed. Ask the department to submit a new request');
      if (!validLicense(driver, trip.endAt)) fail(409, 'Driver needs an uploaded licence valid through the return date');
      if (driver.vehicleType !== trip.vehicleType || driver.capacity < trip.passengers) fail(409, 'Vehicle type or capacity does not match');
      if (await Trip.exists({ driver: driverId, status: { $in: activeStates }, $or: [{ startAt: { $lt: trip.endAt }, endAt: { $gt: trip.startAt } }, { status: 'in_progress' }] }).session(session)) fail(409, 'Driver already has a conflicting trip');
      trip.driver = driver._id; history(trip, req.user, 'assigned'); await trip.save({ session });
    });
    res.json(await populate(Trip.findById(tripId)));
  });
  api.post('/trips/:id/decision', roles('hr', 'department'), async (req, res) => {
    const { action, reason } = z.object({ action: z.enum(['cancelled', 'rejected']), reason: text }).parse(req.body);
    if (action === 'rejected' && req.user.role !== 'hr') fail(403, 'Only HR can reject requests');
    const trip = await Trip.findOneAndUpdate({ _id: id(req.params.id), ...scope(req.user), status: { $in: action === 'rejected' ? ['requested'] : ['requested', 'assigned'] } },
      { $set: { status: action, decisionNote: reason }, $push: { history: { status: action, actor: req.user._id, at: new Date(), note: reason } } }, { returnDocument: 'after' });
    if (!trip) fail(409, 'This trip cannot be cancelled or rejected'); res.json(trip);
  });
  api.post('/trips/:id/start', roles('driver'), async (req, res) => {
    const { odometer } = z.object({ odometer: z.number().nonnegative().max(10000000) }).parse(req.body); const tripId = id(req.params.id);
    await mongoose.connection.transaction(async session => {
      const driver = await User.findByIdAndUpdate(req.user._id, { $inc: { allocationVersion: 1 } }, { returnDocument: 'after', session });
      const trip = await Trip.findOne({ _id: tripId, driver: req.user._id, status: 'assigned' }).session(session);
      if (!trip) fail(409, 'Trip is not assigned to you or has already started');
      if (!validLicense(driver, new Date(Math.max(Date.now(), trip.endAt.getTime())))) fail(409, 'Licence is missing or expired. Contact HR');
      if (driver.availability !== 'available') fail(409, 'Set your availability to available before starting');
      if (Date.now() < trip.startAt.getTime() - 3600000) fail(409, 'You can start up to one hour before departure');
      if (await Trip.exists({ driver: req.user._id, status: 'in_progress' }).session(session)) fail(409, 'Complete your current trip first');
      trip.startOdometer = odometer; trip.startedAt = new Date(); history(trip, req.user, 'in_progress'); await trip.save({ session });
    }); res.json(await Trip.findById(tripId));
  });
  api.post('/trips/:id/complete', roles('driver'), async (req, res) => {
    const { odometer, notes } = z.object({ odometer: z.number().nonnegative().max(10000000), notes: note }).parse(req.body);
    const trip = await Trip.findOne({ _id: id(req.params.id), driver: req.user._id, status: 'in_progress' });
    if (!trip) fail(409, 'Trip is not in progress');
    if (odometer < trip.startOdometer || odometer - trip.startOdometer > 100000) fail(400, 'End odometer must be at least the start reading, with distance under 100,000 km');
    const updated = await Trip.findOneAndUpdate({ _id: trip._id, status: 'in_progress' }, { $set: { status: 'completed', endOdometer: odometer, actualKm: Math.round((odometer - trip.startOdometer) * 10) / 10, completedAt: new Date(), completionNotes: notes }, $push: { history: { status: 'completed', actor: req.user._id, at: new Date() } } }, { returnDocument: 'after' });
    if (!updated) fail(409, 'Trip already completed'); res.json(updated);
  });
  api.post('/trips/:id/feedback', roles('department'), async (req, res) => {
    const data = z.object({ rating: z.number().int().min(1).max(5), comment: note }).parse(req.body);
    const trip = await Trip.findOneAndUpdate({ _id: id(req.params.id), department: req.user._id, status: 'completed', 'feedback.rating': { $exists: false } }, { $set: { feedback: { ...data, at: new Date() } } }, { returnDocument: 'after' });
    if (!trip) fail(409, 'Feedback requires your completed trip and can only be submitted once'); res.json(trip);
  });
  api.get('/drivers/:id/summary', roles('hr', 'driver'), async (req, res) => {
    const driverId = id(req.params.id);
    if (req.user.role === 'driver' && String(req.user._id) !== driverId) fail(403, 'Access denied');
    const today = DateTime.now().setZone(zone());
    res.json(await reportData(String(req.query.from || today.startOf('month').toISODate()), String(req.query.to || today.toISODate()), driverId));
  });
  api.get('/reports/monthly', roles('hr'), async (req, res) => { await catchUpMonthlyReports(); res.json(await Report.find().select('-trips').sort({ month: -1 }).limit(120)); });
  api.get('/reports/custom', roles('hr'), async (req, res) => {
    const data = await reportData(String(req.query.from), String(req.query.to), req.query.driverId ? id(req.query.driverId) : undefined);
    if (req.query.format !== 'xlsx') return res.json(data);
    res.set('Content-Disposition', 'attachment; filename="hr-transport-report.xlsx"').type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(Buffer.from(await workbook(data)));
  });
  api.get('/reports/monthly/:month', roles('hr'), async (req, res) => {
    const month = z.string().regex(/^\d{4}-\d{2}$/).parse(req.params.month);
    const data = await Report.findOne({ month }).lean(); if (!data) fail(404, 'Monthly report not available yet');
    res.set('Content-Disposition', `attachment; filename="hr-transport-${month}.xlsx"`).type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(Buffer.from(await workbook(data)));
  });
  app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
  app.use((err, req, res, next) => {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.issues.map(i => `${i.path.join('.') || 'Request'}: ${i.message}`).join('; ') });
    if (err.code === 11000) return res.status(409).json({ error: 'That email or record already exists' });
    if (err instanceof multer.MulterError) return res.status(400).json({ error: 'Upload one file, no larger than 5 MB' });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Server error. Please try again.' : err.message });
  });
  return app;
}

