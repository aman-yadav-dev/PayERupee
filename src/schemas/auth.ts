import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  businessName: z.string().trim().min(2).max(150),

  // <-- ADD THE ADDRESS VALIDATION HERE
  address: z
    .string()
    .trim()
    .min(10, "Address must be at least 10 characters")
    .max(255, "Address is too long"),

  phone: z.string().trim().min(10).max(15),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(128),
  termsAccepted: z
    .boolean()
    .default(false)
    .refine((val) => val === true, {
      message: "You must accept the Terms of Service & Privacy Policy",
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
