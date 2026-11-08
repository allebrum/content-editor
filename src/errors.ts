export type DocumentErrorCode =
  | 'legacy_page_editor_document'
  | 'unsupported_document'
  | 'invalid_document'
  | 'unsupported_block_type'
  | 'unsafe_content';

export class DocumentParseError extends Error {
  readonly code: DocumentErrorCode;
  readonly details?: unknown;

  constructor(code: DocumentErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DocumentParseError';
    this.code = code;
    this.details = details;
  }
}
