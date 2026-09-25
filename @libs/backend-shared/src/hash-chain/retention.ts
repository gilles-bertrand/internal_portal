export function computeRetentionUntil(accessedAt: string, durationDays: number): string {
  const date = new Date(accessedAt);
  date.setUTCDate(date.getUTCDate() + durationDays);
  return date.toISOString();
}
