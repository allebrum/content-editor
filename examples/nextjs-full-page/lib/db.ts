// lib/db.ts
// Placeholder database interface — replace with your actual ORM/query client
// (e.g. Prisma, Drizzle, Supabase, Postgres.js)
import type { EditorJsonDocument, EditorAsset } from '@allebrum/page-editor';

export interface PageRecord {
  id: string;
  slug: string;
  title: string;
  editor_json: EditorJsonDocument;
  editor_schema_version: string;
  rendered_html: string | null;
  plain_text: string | null;
  asset_manifest: EditorAsset[] | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getPageBySlug(slug: string): Promise<PageRecord | null> {
  // Replace with: return await db.pages.findOne({ where: { slug } });
  throw new Error('getPageBySlug not implemented — replace with your DB call');
}

export async function updatePage(
  slug: string,
  data: Partial<PageRecord>,
): Promise<void> {
  // Replace with: await db.pages.update({ where: { slug }, data });
  throw new Error('updatePage not implemented — replace with your DB call');
}
