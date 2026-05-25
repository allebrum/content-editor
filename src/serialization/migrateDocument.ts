import type { EditorJsonDocument } from '../schema/types';

type MigrationFn = (doc: EditorJsonDocument) => EditorJsonDocument;

const migrations: Record<string, MigrationFn> = {
  // Example migration: '0.9.0->1.0.0': (doc) => { ... return doc; }
};

function versionToNumber(v: string): number {
  const [major, minor, patch] = v.split('.').map(Number);
  return major * 1_000_000 + minor * 1_000 + (patch ?? 0);
}

export function migrateDocument(
  doc: EditorJsonDocument,
  fromVersion: string,
  toVersion: string,
): EditorJsonDocument {
  const migrationKeys = Object.keys(migrations).sort((a, b) => {
    const [, aTo] = a.split('->');
    const [, bTo] = b.split('->');
    return versionToNumber(aTo) - versionToNumber(bTo);
  });

  let current = doc;
  let currentVersion = fromVersion;

  for (const key of migrationKeys) {
    const [from, to] = key.split('->');
    if (
      versionToNumber(currentVersion) >= versionToNumber(from) &&
      versionToNumber(currentVersion) < versionToNumber(to) &&
      versionToNumber(to) <= versionToNumber(toVersion)
    ) {
      current = migrations[key](current);
      currentVersion = to;
    }
  }

  return current;
}
