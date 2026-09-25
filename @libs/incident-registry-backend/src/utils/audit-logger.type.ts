export interface AuditLogInput {
  actorId: string;
  action: string;
  targetType: string;
  targetRef: string;
  outcome: "success" | "failure";
  ip: string;
  userAgent: string | null;
}

export interface AuditLogger {
  log(input: AuditLogInput): Promise<void>;
}
