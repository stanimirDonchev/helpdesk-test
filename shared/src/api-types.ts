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
