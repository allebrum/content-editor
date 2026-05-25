// app/pages/[slug]/page.tsx
// Public-facing read-only page — rendered server-side from editor JSON
import { notFound } from 'next/navigation';
import { PageRenderer } from '@allebrum/page-editor/renderer';
import { getPageBySlug } from '../../../lib/db';

interface PublicPageProps {
  params: { slug: string };
}

export default async function PublicPage({ params }: PublicPageProps) {
  const page = await getPageBySlug(params.slug);
  if (!page || !page.published_at) notFound();

  return (
    <main>
      <PageRenderer
        document={page.editor_json}
        assetResolver={(asset) => `/uploads/${asset.id}`}
        className="page-content"
      />
    </main>
  );
}

// Optionally pre-render static pages at build time
export async function generateStaticParams() {
  const pages = await getAllPublishedPageSlugs();
  return pages.map((slug) => ({ slug }));
}

async function getAllPublishedPageSlugs(): Promise<string[]> {
  // Replace with your actual DB query
  return [];
}
