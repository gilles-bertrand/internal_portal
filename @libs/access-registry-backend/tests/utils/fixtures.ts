export function accessRecordPayload(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      type: "access-records",
      attributes: {
        accessedAt: "2024-06-01T09:00:00.000Z",
        accessorRef: "emp-001",
        dataSubjectRef: "cust-abc",
        dataCategories: ["identité"],
        isSpecialCategory: false,
        accessType: "consultation",
        purpose: "support",
        legalBasis: "art6.1b",
        sourceSystem: "CRM",
        justification: "Test matrice de permissions",
        ...overrides,
      },
    },
  };
}
