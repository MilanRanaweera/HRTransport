import ExcelJS from 'exceljs';
import { DateTime } from 'luxon';
import { Trip, User, Report } from './models.js';
import { period, zone } from './domain.js';
export async function reportData(from, to, driverId) {
  const { start, end } = period(from, to);
  const drivers = await User.find({ role: 'driver', ...(driverId ? { _id: driverId } : {}) }).lean();
  const rows = await Trip.find({ status: 'completed', completedAt: { $gte: start, $lt: end }, ...(driverId ? { driver: driverId } : {}) })
    .populate('department', 'name departmentName').populate('driver', 'name vehiclePlate').sort({ completedAt: 1 }).lean();
  const summary = drivers.map(d => {
    const trips = rows.filter(t => String(t.driver?._id) === String(d._id));
    const ratings = trips.filter(t => t.feedback?.rating);
    return { driverId: String(d._id), name: d.name, vehicle: d.vehicleType, plate: d.vehiclePlate,
      trips: trips.length, kilometres: Math.round(trips.reduce((s, t) => s + (t.actualKm || 0), 0) * 10) / 10,
      rating: ratings.length ? Math.round(ratings.reduce((s, t) => s + t.feedback.rating, 0) / ratings.length * 100) / 100 : null,
      feedbackCount: ratings.length, locations: [...new Set(trips.flatMap(t => [t.pickup, t.destination]))].join('; ') };
  });
  const trips = rows.map(t => ({ id: String(t._id), driver: t.driver?.name || 'Unknown', department: t.department?.departmentName || t.department?.name,
    title: t.title, pickup: t.pickup, destination: t.destination, stops: t.stops,
    completed: DateTime.fromJSDate(t.completedAt).setZone(zone()).toFormat('yyyy-MM-dd HH:mm'),
    estimatedKm: t.estimatedKm, actualKm: t.actualKm, startOdometer: t.startOdometer, endOdometer: t.endOdometer,
    rating: t.feedback?.rating ?? null, feedback: t.feedback?.comment || '', notes: t.completionNotes || '' }));
  return { from, to, timezone: zone(), generatedAt: new Date(), summary, trips };
}
export async function workbook(data) {
  const book = new ExcelJS.Workbook();
  book.creator = 'HR Transport'; book.created = new Date();
  const info = book.addWorksheet('Report details');
  info.columns = [{ width: 28 }, { width: 70 }];
  info.addRows([['HR Transport', 'Driver activity report'], ['Period', data.month || `${data.from} to ${data.to}`], ['Timezone', data.timezone], ['Generated at', new Date(data.generatedAt).toISOString()], ['Basis', 'Completed trips, grouped by completion date. Kilometres = end minus start odometer.'], ['Feedback', 'Monthly snapshots retain feedback available when generated. Custom reports include latest feedback.']]);
  const definitions = [
    ['Driver summary', data.summary, [['name','Driver',25],['vehicle','Vehicle',15],['plate','Registration',18],['trips','Completed trips',18],['kilometres','Actual km',16],['rating','Average rating / 5',22],['feedbackCount','Ratings received',20],['locations','Locations',55]]],
    ['Trip details', data.trips, [['id','Trip ID',28],['driver','Driver',25],['department','Department',25],['title','Task',30],['pickup','Pickup',30],['destination','Destination',30],['stops','Other stops',30],['completed','Completed (local)',23],['estimatedKm','Estimated km',18],['actualKm','Actual km',18],['startOdometer','Start odometer',20],['endOdometer','End odometer',20],['rating','Rating / 5',15],['feedback','Feedback',45],['notes','Completion notes',45]]],
  ];
  for (const [name, rows, cols] of definitions) {
    const sheet = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = cols.map(([key, header, width]) => ({ key, header, width }));
    // User content is assigned as string cell values, never as Excel formulas.
    sheet.addRows(rows);
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, rows.length + 1), column: cols.length } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF163B35' } };
    sheet.getRow(1).height = 28;
    sheet.eachRow((row, index) => { if (index > 1) row.alignment = { vertical: 'top', wrapText: true }; });
  }
  return book.xlsx.writeBuffer();
}
let running = false;
export async function catchUpMonthlyReports(now = DateTime.now().setZone(zone())) {
  if (running) return;
  running = true;
  try {
    const earliest = await Trip.findOne({ status: 'completed' }).sort({ completedAt: 1 }).lean();
    let month = earliest ? DateTime.fromJSDate(earliest.completedAt).setZone(zone()).startOf('month') : now.minus({ months: 1 }).startOf('month');
    const boundary = now.startOf('month');
    while (month < boundary) {
      const key = month.toFormat('yyyy-MM');
      if (!await Report.exists({ month: key })) {
        const data = await reportData(month.toISODate(), month.endOf('month').toISODate());
        await Report.updateOne({ month: key }, { $setOnInsert: { month: key, timezone: zone(), generatedAt: new Date(), summary: data.summary, trips: data.trips } }, { upsert: true });
      }
      month = month.plus({ months: 1 });
    }
  } finally { running = false; }
}
