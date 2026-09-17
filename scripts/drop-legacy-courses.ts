/**
 * One-off cleanup: drops the old, single embedded `courses` collection so the
 * new LMS schema (lms_courses / lms_course_modules / lms_lessons / lms_resources /
 * lms_enrollments / lms_lesson_progress) starts from a clean state.
 *
 * Run with:  pnpm exec ts-node scripts/drop-legacy-courses.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';

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
  const collections = await db.listCollections().toArray();
  const names = new Set(collections.map((c) => c.name));
  if (names.has('courses')) {
    await db.dropCollection('courses');
    console.log('Dropped legacy collection: courses');
  } else {
    console.log('No legacy "courses" collection to drop. Skipping.');
  }
  await mongoose.disconnect();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
