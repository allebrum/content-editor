import type { EditorJsonDocument, EditorAssetManifest, Block } from '../schema/types';

type AssetRef = {
  id: string;
  type: 'image' | 'video' | 'svg' | 'file';
  url?: string;
};

function collectAssetsFromBlock(block: Block, assets: AssetRef[]): void {
  const b = block as {
    type: string;
    attrs?: Record<string, unknown>;
    content?: Block[];
  };

  if ((b.type === 'image' || b.type === 'imageBlock') && b.attrs?.assetId) {
    assets.push({ id: String(b.attrs.assetId), type: 'image', url: String(b.attrs.src ?? '') });
  }
  if (b.type === 'embed' && b.attrs?.url) {
    assets.push({ id: String(b.attrs.id ?? b.attrs.url), type: 'video', url: String(b.attrs.url) });
  }
  if (b.type === 'svgGraphic' && b.attrs?.id) {
    assets.push({ id: String(b.attrs.id), type: 'svg' });
  }

  if (b.content) {
    b.content.forEach((child) => collectAssetsFromBlock(child, assets));
  }
}

export function buildAssetManifest(doc: EditorJsonDocument): EditorAssetManifest {
  const refs: AssetRef[] = [];
  (doc.content ?? []).forEach((block) => collectAssetsFromBlock(block, refs));

  const manifest: EditorAssetManifest = { images: [], videos: [], svgs: [], files: [] };

  for (const ref of refs) {
    const asset = {
      id: ref.id,
      type: ref.type,
      url: ref.url ?? '',
    };
    if (ref.type === 'image') manifest.images.push(asset);
    else if (ref.type === 'video') manifest.videos.push(asset);
    else if (ref.type === 'svg') manifest.svgs.push(asset);
    else manifest.files.push(asset);
  }

  return manifest;
}
