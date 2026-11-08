/**
 * Phone helpers shared by client and server code. Pure functions only —
 * no database, no environment, no imports — so client components can use
 * them without pulling server-only modules into the browser bundle.
 */

/**
 * Normalize a Bangladeshi phone number to the digits-only international
 * form WhatsApp links need.
 *
 * wa.me takes the number in international format with NO '+' and no
 * spaces, dashes or brackets: https://wa.me/8801330792610. A number
 * stored in local form (01330792610) carries no country code, and
 * WhatsApp refuses it ("couldn't look up phone number ... missing a
 * country code or has the wrong one").
 *
 *   01330792610    -> 8801330792610   (+8801330792610)
 *   +8801330792610 -> 8801330792610
 *   8801330792610  -> 8801330792610
 *   01330-792610   -> 8801330792610
 *   1330792610     -> 8801330792610
 *   ''             -> '' (caller hides the link)
 */
export function toWhatsAppDigits(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `880${digits.slice(1)}`;
  if (digits.length === 10) return `880${digits}`;
  return digits;
}
