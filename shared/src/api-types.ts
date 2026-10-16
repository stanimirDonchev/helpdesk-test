import type { SenderType, TicketCategory, TicketStatus } from "./ticket-types";
import { UserRole } from "./user-types";

export interface HealthResponse {
  status: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface UsersListResponse {
  users: UserSummary[];
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
}

export interface CreateUserResponse {
  user: UserSummary;
}

export interface UpdateUserRequest {
  name: string;
  email: string;
  /** Omit entirely to leave the current password unchanged. */
  password?: string;
}

export interface UpdateUserResponse {
  user: UserSummary;
}

export interface DeleteUserResponse {
  user: UserSummary;
}

export interface TicketSummary {
  id: string;
  subject: string;
  senderEmail: string;
  senderName: string | null;
  status: TicketStatus;
  /** Null until Phase 4's AI classification runs. */
  category: TicketCategory | null;
  receivedAt: string;
}

export interface TicketReply {
  id: string;
  senderType: SenderType;
  body: string;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  body: string;
  replies: TicketReply[];
}

export interface TicketsListResponse {
  tickets: TicketSummary[];
}

export interface TicketResponse {
  ticket: TicketDetail;
}
