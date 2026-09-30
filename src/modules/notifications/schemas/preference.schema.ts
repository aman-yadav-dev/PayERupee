import { z } from "zod";

export const updateNotificationPreferenceSchema = z.object({
  loginEmailsEnabled: z.boolean().optional(),
  kycEmailsEnabled: z.boolean().optional(),
}).strict(); // Reject arbitrary fields
