export type DocumentKind =
  | "bank_statement"
  | "invoice"
  | "pay_stub"
  | "w2"
  | "form_1099"
  | "generic_financial";

export type FieldStatus =
  | "verified"
  | "pending_review"
  | "low_confidence"
  | "missing"
  | "malformed";

export type RowKind = "field" | "transaction" | "line_item";

export type ValueKind = "date" | "currency" | "id" | "text";

export type ProcessingStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "ready"
  | "error";

export type PipelineStepId =
  | "upload_received"
  | "analyzing"
  | "detecting_type"
  | "extracting_text"
  | "ai_organize"
  | "review_prep"
  | "ready_export";

export type PipelineStepState = "pending" | "active" | "complete" | "error";

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  state: PipelineStepState;
}

export type AppErrorKind =
  | "unsupported"
  | "corrupted"
  | "partial"
  | "timeout"
  | null;

export interface UploadedFileMeta {
  name: string;
  size: number;
  uploadedAt: string;
}

export interface DetectionResult {
  kind: DocumentKind;
  label: string;
  confidence: number;
  schemaId: string;
  schemaTitle: string;
  usedFallback: boolean;
  rationale: string;
}

export interface ExtractionRow {
  id: string;
  section: string;
  label: string;
  value: string;
  confidence: number;
  status: FieldStatus;
  reviewed: boolean;
  critical?: boolean;
  rowKind: RowKind;
  valueKind?: ValueKind;
}
