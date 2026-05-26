import type { AssetConfig, MediaPickerRequest, MediaPickerResult } from '../schema/types';

const DEFAULT_PLACEHOLDER = 'https://placehold.co/1600x900/png?text=Selected+Image';

export async function pickImageAsset(
  assets: AssetConfig | undefined,
  request: MediaPickerRequest,
): Promise<MediaPickerResult | null> {
  if (assets?.openMediaPicker) {
    return await assets.openMediaPicker(request);
  }

  return {
    url: assets?.placeholderImageUrl || DEFAULT_PLACEHOLDER,
    alt: '',
  };
}
