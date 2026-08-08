import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password is too long"),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long"),
  businessName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(150, "Business name is too long"),
  address: z
    .string()
    .trim()
    .min(5, "Business address must be at least 5 characters")
    .max(255, "Address is too long"),
  phone: z
    .string()
    .trim()
    .min(10, "Please enter a valid 10-digit phone number")
    .max(15, "Phone number is too long"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  termsAccepted: z
    .boolean()
    .default(false)
    .refine((val) => val === true, {
      message: "You must accept the Terms of Service & Privacy Policy",
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
