// app/api/editor-assets/route.ts
// Asset upload endpoint — stores files in your own storage
import { NextRequest, NextResponse } from 'next/server';
import type { EditorAsset } from '@allebrum/page-editor';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  // TODO: Add your own auth check here

  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
  }

  // Validate file size (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }

  // TODO: Upload to your storage provider (S3, Cloudflare R2, Vercel Blob, etc.)
  // const buffer = Buffer.from(await file.arrayBuffer());
  // const url = await uploadToStorage(buffer, file.name, file.type);

  // For this example, return a mock asset
  const assetId = randomUUID();
  const asset: EditorAsset = {
    id: assetId,
    type: file.type.startsWith('image/') ? 'image' : 'file',
    url: `/uploads/${assetId}`,
    metadata: {
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
    },
  };

  return NextResponse.json(asset);
}
