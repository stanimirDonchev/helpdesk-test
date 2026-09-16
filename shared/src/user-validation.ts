import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(3, { error: "Name must be at least 3 characters" }),
  email: z.email({ error: "Enter a valid email address" }),
  password: z.string().trim().min(8, { error: "Password must be at least 8 characters" }),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
