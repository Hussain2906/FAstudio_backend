import type { AdminRole } from '../../generated/prisma/enums.js';

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  role: AdminRole;
  sessionId: string;
};
