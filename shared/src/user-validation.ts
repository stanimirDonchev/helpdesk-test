import { z } from "zod";

// Shared field definitions so the create and edit forms can't drift apart on
// rules or on the exact message strings the UI renders.
const nameField = z.string().trim().min(3, { error: "Name must be at least 3 characters" });
// Better Auth stores sign-up emails lowercased and looks them up lowercased on
// sign-in, so an email written straight through Prisma has to be normalized the
// same way or the user can't sign in again. `.toLowerCase()` runs *after* the
// format check; a `.trim()` here would run *before* it and reject padded input.
const emailField = z.email({ error: "Enter a valid email address" }).toLowerCase();
const passwordField = z.string().trim().min(8, { error: "Password must be at least 8 characters" });

export const createUserSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

// Edit form, client side. The password input is always a string — blank means
// "keep the current password". Deliberately not `.optional()` or a
// `.transform()`: keeping the output type `string` means `z.input` and
// `z.output` match (so `useForm` needs only its first generic) *and* keeps this
// shape structurally identical to `CreateUserFormValues`, which is what lets
// both dialogs pass `register`/`errors` to one non-generic field component.
export const updateUserFormSchema = z.object({
  name: nameField,
  email: emailField,
  password: z
    .string()
    .trim()
    .refine((value) => value === "" || value.length >= 8, {
      error: "Password must be at least 8 characters",
    }),
});

export type UpdateUserFormValues = z.infer<typeof updateUserFormSchema>;

// Edit request, server side. On the wire "keep the current password" is the
// field being absent, not an empty string — the dialog drops it before sending.
export const updateUserSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField.optional(),
});
