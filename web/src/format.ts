// Money formatting: backend stores integer cents to avoid float drift.
export function yuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return iso.replace("T", " ").slice(0, 16);
}

export const STATUS_TEXT: Record<string, string> = {
  pending_payment: "待支付",
  paid: "已支付",
  cancelled: "已取消",
  completed: "已完成",
};
