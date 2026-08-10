/**
 * Provider-Neutral Logging Boundary.
 * 
 * Ensures sensitive information (API Keys, Authorizations, webhooks secrets)
 * are NEVER accidentally printed to standard output.
 */
export const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, sanitizeMeta(meta));
  },
  error: (message: string, error?: any, meta?: any) => {
    console.error(`[ERROR] ${message}`, sanitizeMeta(error), sanitizeMeta(meta));
  },
};

function sanitizeMeta(meta: any) {
  if (!meta) return meta;
  if (typeof meta !== "object") return meta;

  const sanitized = { ...meta };
  // Explicit Redaction List
  const redactKeys = ["Authorization", "apiKey", "secret", "X-Provider-Signature"];
  
  for (const key of Object.keys(sanitized)) {
    if (redactKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    }
  }
  
  return sanitized;
}
