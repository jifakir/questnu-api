/**
 * One-off import of the blog posts that used to be hardcoded in questnu-front.
 * Reads data/blog-seed-posts.json and inserts each post as published, keeping
 * its original slug and dates. Posts whose slug already exists are skipped,
 * so it is safe to run more than once.
 *
 * Run with:  pnpm exec ts-node scripts/seed-blog-posts.ts
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';

type SeedContent = {
  title: string;
  excerpt: string;
  description: string;
  category: string;
  keywords: string[];
  body: string;
};
type SeedPost = {
  slug: string;
  publishedAt: string;
  updatedAt: string;
  bn: SeedContent;
  en?: SeedContent;
};

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  const file = path.join(__dirname, '..', 'data', 'blog-seed-posts.json');
  const posts = JSON.parse(readFileSync(file, 'utf8')) as SeedPost[];

  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('blog_posts');
  await collection.createIndex({ slug: 1 }, { unique: true });

  for (const post of posts) {
    if (await collection.findOne({ slug: post.slug })) {
      console.log(`Skipped (already exists): ${post.slug}`);
      continue;
    }
    await collection.insertOne({
      slug: post.slug,
      status: 'published',
      publishedAt: new Date(post.publishedAt),
      bn: post.bn,
      ...(post.en ? { en: post.en } : {}),
      createdAt: new Date(post.publishedAt),
      updatedAt: new Date(post.updatedAt),
    });
    console.log(`Imported: ${post.slug}`);
  }
  await mongoose.disconnect();
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
