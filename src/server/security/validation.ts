import { z } from "zod";

// Roles supported by the app (must stay in sync with src/lib/auth.tsx Role type).
export const roleSchema = z.enum(["passenger", "owner", "advertiser", "auditor"]);

// Defense in depth: strip control characters even though React escapes output
// on render — this keeps the value clean wherever else it's used (logs, DB,
// emails, exports).
const stripControlChars = (s: string) =>
  Array.from(s)
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f;
    })
    .join("");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name is too long")
  .transform(stripControlChars);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .email("Invalid email address");

// Length + character-class requirements without being so strict it rejects
// legitimate passphrases; complexity is enforced by minimum entropy proxy
// (length) plus at least one letter and one digit.
export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(256, "Password is too long")
  .refine((p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p), {
    message: "Password must contain at least one letter and one number",
  });

export const signupSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: roleSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(256),
});

// Allowlist of image types accepted for avatar uploads. Matched against
// sniffed magic bytes server-side, never trusted from the client-supplied
// Content-Type header or filename extension.
export const ALLOWED_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MiB
