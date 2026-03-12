/**
 * West African phone number validation.
 * Covers UEMOA + CEMAC country codes.
 */

const WEST_AFRICAN_PHONE_REGEX =
  /^\+?(225|221|223|226|228|229|227|224|237|242|241|243)\d{8,10}$/;

export function validatePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (!WEST_AFRICAN_PHONE_REGEX.test(cleaned)) {
    return "Invalid phone number. Expected format: +225XXXXXXXXXX (West African country code + 8-10 digits)";
  }
  return null;
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}
