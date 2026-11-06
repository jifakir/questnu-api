/**
 * One-off migration for notification audience targeting (and the "edited" tag).
 *
 * - Gives every existing notification empty `targetYears` / `targetDepartments`
 *   lists, which means "everyone" (the API already treats missing fields the
 *   same way, so this only makes the data explicit).
 * - Creates the indexes on those two fields.
 *
 * Safe to run more than once. Run it after deploying the new API:
 *   pnpm exec ts-node scripts/migrate-notification-audience.ts
 * Preview without changing anything:
 *   pnpm exec ts-node scripts/migrate-notification-audience.ts --dry-run
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error('Could not access database');
    process.exit(1);
  }
  console.log(`Database: ${db.databaseName}${dryRun ? ' (dry run)' : ''}`);

  const notifications = db.collection('notifications');
  const total = await notifications.countDocuments();

  for (const field of ['targetYears', 'targetDepartments']) {
    const missing = { [field]: { $exists: false } };
    const count = await notifications.countDocuments(missing);
    if (dryRun) {
      console.log(`${field}: ${count} of ${total} notifications would be set to []`);
      continue;
    }
    const res = await notifications.updateMany(missing, {
      $set: { [field]: [] },
    });
    console.log(`${field}: set [] on ${res.modifiedCount} of ${total} notifications`);
  }

  if (dryRun) {
    console.log('Would create indexes: targetYears_1, targetDepartments_1');
  } else {
    await notifications.createIndex({ targetYears: 1 });
    await notifications.createIndex({ targetDepartments: 1 });
    console.log('Indexes ready: targetYears_1, targetDepartments_1');
  }

  await mongoose.disconnect();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
