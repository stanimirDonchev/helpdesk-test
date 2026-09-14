export const UserRole = {
  admin: "admin",
  agent: "agent",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];
