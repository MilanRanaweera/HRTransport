import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const ref = (name) => ({ type: Schema.Types.ObjectId, ref: name });
const userSchema = new Schema({
  name: { type: String, required: true }, email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['hr', 'department', 'driver'], required: true },
  phone: String, departmentName: String, active: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 }, photo: ref('Asset'),
  availability: { type: String, enum: ['available', 'unavailable', 'leave'], default: 'available' },
  vehicleType: String, vehiclePlate: String, capacity: Number,
  licenseNumber: String, licenseExpiry: String, licenseFile: ref('Asset'), notes: String,
  allocationVersion: { type: Number, default: 0 },
}, { timestamps: true });
export const User = model('User', userSchema);
export const Trip = model('Trip', new Schema({
  department: { ...ref('User'), required: true }, driver: ref('User'),
  title: String, pickup: String, destination: String, stops: String,
  startAt: Date, endAt: Date, estimatedKm: Number, passengers: Number,
  vehicleType: String, contactName: String, contactPhone: String, notes: String,
  status: { type: String, enum: ['requested', 'assigned', 'in_progress', 'completed', 'rejected', 'cancelled'], default: 'requested' },
  startOdometer: Number, endOdometer: Number, actualKm: Number,
  startedAt: Date, completedAt: Date, completionNotes: String, decisionNote: String,
  feedback: { rating: Number, comment: String, at: Date },
  history: [{ status: String, actor: ref('User'), at: Date, note: String }],
}, { timestamps: true }).index({ driver: 1, status: 1, startAt: 1, endAt: 1 }).index({ department: 1, createdAt: -1 }));
export const Asset = model('Asset', new Schema({ owner: ref('User'), kind: String, mime: String, name: String, data: { type: Buffer, select: false } }, { timestamps: true }));
export const Report = model('Report', new Schema({ month: { type: String, unique: true }, timezone: String, generatedAt: Date, summary: [Schema.Types.Mixed], trips: [Schema.Types.Mixed] }));
export function publicUser(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash; delete obj.tokenVersion; delete obj.allocationVersion; delete obj.__v;
  return obj;
}
