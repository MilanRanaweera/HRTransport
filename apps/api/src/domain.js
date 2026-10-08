import { DateTime } from 'luxon';
import { z } from 'zod';
export const vehicles = ['Car', 'Van', 'Tuk', 'Lorry', 'Bus', 'Motorcycle', 'Other'];
export const text = z.string().trim().min(1).max(200);
export const note = z.string().trim().max(2000).default('');
export const phone = z.string().trim().min(7).max(30).regex(/^[+\d ()-]+$/);
export const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => DateTime.fromISO(v).isValid, 'Invalid calendar date');
export const accountSchema = z.object({
  name: text, email: z.email().toLowerCase(), password: z.string().min(10).max(100),
  role: z.enum(['department', 'driver']), phone,
  departmentName: text.optional(), vehicleType: z.enum(vehicles).optional(),
  vehiclePlate: text.optional(), capacity: z.number().int().min(1).max(100).optional(),
  licenseNumber: text.optional(), licenseExpiry: day.optional(), notes: note,
}).superRefine((v, ctx) => {
  const fields = v.role === 'driver' ? ['vehicleType', 'vehiclePlate', 'capacity', 'licenseNumber', 'licenseExpiry'] : ['departmentName'];
  for (const field of fields) if (!v[field]) ctx.addIssue({ code: 'custom', path: [field], message: `${field} is required` });
});
export const tripSchema = z.object({
  title: text, pickup: text, destination: text, stops: note,
  startAt: z.iso.datetime({ offset: true }), endAt: z.iso.datetime({ offset: true }),
  estimatedKm: z.number().positive().max(100000), passengers: z.number().int().min(1).max(100),
  vehicleType: z.enum(vehicles), contactName: text, contactPhone: phone, notes: note,
}).refine(v => new Date(v.endAt) > new Date(v.startAt), { message: 'Return time must be after departure' })
  .refine(v => new Date(v.startAt).getTime() > Date.now(), { message: 'Departure must be in the future' });
export function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export function zone() { return process.env.REPORT_TIMEZONE || 'Asia/Colombo'; }
export function validLicense(driver, endAt) {
  return Boolean(driver.licenseFile && driver.licenseExpiry && driver.licenseExpiry >= DateTime.fromJSDate(new Date(endAt)).setZone(zone()).toISODate());
}
export function period(from, to) {
  day.parse(from); day.parse(to);
  const start = DateTime.fromISO(from, { zone: zone() }).startOf('day');
  const end = DateTime.fromISO(to, { zone: zone() }).plus({ days: 1 }).startOf('day');
  if (end <= start || end.diff(start, 'days').days > 3660) fail(400, 'Choose a valid range of up to 10 years');
  return { start: start.toJSDate(), end: end.toJSDate() };
}
