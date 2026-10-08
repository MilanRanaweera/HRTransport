import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.MONGOMS_DOWNLOAD_DIR = path.join(root, '.cache', 'mongodb-binaries');
process.env.MONGOMS_VERSION ||= '7.0.24';
process.env.TEMP = path.join(root, '.cache', 'temp'); process.env.TMP = process.env.TEMP;
const dbPath = path.join(root, 'data', 'mongodb');
await mkdir(dbPath, { recursive: true }); await mkdir(process.env.TEMP, { recursive: true });
const { MongoMemoryReplSet } = await import('mongodb-memory-server');
await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', () => reject(new Error('Port 27017 is already in use. Stop the existing development database or configure its replica-set URI.')));
  probe.listen(27017, '127.0.0.1', () => probe.close(resolve));
});
const database = await MongoMemoryReplSet.create({ binary: { downloadDir: process.env.MONGOMS_DOWNLOAD_DIR }, replSet: { name: 'rs0', count: 1, storageEngine: 'wiredTiger', ip: '127.0.0.1' }, instanceOpts: [{ port: 27017, dbPath }] });
console.log('Development MongoDB running at mongodb://127.0.0.1:27017/hr_transport?replicaSet=rs0');
console.log('Data is persistent at ' + dbPath + '. Keep this terminal open. Press Ctrl+C to stop.');
async function stop() { await database.stop({ doCleanup: false }); process.exit(0); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
