import { z } from "zod";

const phoneValidator = z
  .string()
  .trim()
  .regex(/^[6789]\d{9}$/, "Please enter a valid 10-digit phone number")
  .refine((val) => !/^(\d)\1{9}$/.test(val), "Please enter a valid phone number");

const emailValidator = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address")
  .refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), "Please enter a valid email address");

export const loginSchema = z.object({
  email: emailValidator,
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(128, "Password is too long"),
});

export const passwordValidator = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password is too long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long"),
  phone: phoneValidator,
  email: emailValidator,
  password: passwordValidator,
  confirmPassword: z.string().min(1, "Please confirm your password"),
  termsAccepted: z
    .boolean()
    .default(false)
    .refine((val) => val === true, {
      message: "You must accept the Terms of Service & Privacy Policy",
    }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const forgotPasswordSchema = z.object({
  email: emailValidator,
});

export const resetPasswordSchema = z.object({
  password: passwordValidator,
  confirmPassword: z.string().min(1, "Please confirm your password"),
  token: z.string().min(1, "Token is required"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const onboardingSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, "Company name must be at least 2 characters")
    .max(150, "Company name is too long"),
  phone: phoneValidator,
  address: z
    .string()
    .trim()
    .min(5, "Address must be at least 5 characters")
    .max(255, "Address is too long"),
  termsAccepted: z
    .boolean()
    .default(false)
    .refine((val) => val === true, {
      message: "You must accept the Terms of Service & Privacy Policy",
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
