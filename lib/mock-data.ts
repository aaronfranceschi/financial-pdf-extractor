export const MOCK_PEOPLE = [
  "Jordan Lee",
  "Priya Desai",
  "Marcus Chen",
  "Elena Rosario",
  "Noah Kim",
];

export const MOCK_VENDORS = [
  "Northwind Utilities",
  "Harbor Dental Group",
  "Summit Cloud LLC",
  "Atlas Freight Co.",
  "Brightline Software",
];

export const MOCK_BANKS = [
  "Meridian Trust",
  "Coastal Community Bank",
  "First Harbor Federal",
];

export const MOCK_EMPLOYERS = [
  "Aperture Analytics",
  "Blueforge Manufacturing",
  "Citywide Transit Authority",
];

export const MOCK_TRANSACTION_MEMOS = [
  "ACH Payment: partial desc…",
  "POS Purchase: Coffee &…",
  "Wire Transfer ref TRX-9…",
  "Subscription renewal (proc…",
  "Payroll deposit: ACH",
];

export function pickSeeded<T>(arr: readonly T[], seed: number): T {
  const idx = Math.abs(seed) % arr.length;
  return arr[idx]!;
}
