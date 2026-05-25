import type { EditorSaveResult } from '../schema/types';

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export type AutosaveConfig = {
  enabled: boolean;
  debounceMs?: number;
};

export type AutosaveCallbacks = {
  onAutosaveStart?: () => void;
  onAutosaveSuccess?: (result: EditorSaveResult) => void;
  onAutosaveError?: (error: Error) => void;
};
