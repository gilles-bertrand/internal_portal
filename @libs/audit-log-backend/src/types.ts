export interface AuditLogInput {
  actorId: string;
  action: string;
  targetType: string;
  targetRef: string;
  outcome: "success" | "failure";
  ip: string;
  userAgent: string | null;
}
