// app/edit/[slug]/page.tsx
// Server Component — fetches page data, renders client editor
import { notFound } from 'next/navigation';
import { PageEditorView } from '../../components/PageEditorView';
import { getPageBySlug } from '../../../lib/db';

interface EditPageProps {
  params: { slug: string };
}

export default async function EditPage({ params }: EditPageProps) {
  const page = await getPageBySlug(params.slug);
  if (!page) notFound();

  return (
    <PageEditorView
      slug={params.slug}
      initialDocument={page.editor_json}
    />
  );
}
