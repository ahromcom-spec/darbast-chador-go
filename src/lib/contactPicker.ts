/**
 * Pick a contact from the phone's address book (Contact Picker API).
 * Supported on Android Chrome / Samsung Internet; not on iPhone Safari or desktop browsers.
 */

export interface PickedContact {
  name: string;
  phone: string;
}

interface RawContact {
  name?: string[];
  tel?: string[];
}

const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC = '٠١٢٣٤٥٦٧٨٩';

/** Normalize any phone format (+98, 0098, Persian digits, spaces) to 09xxxxxxxxx when possible. */
export function normalizeContactPhone(phone: string): string {
  let raw = (phone || '')
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC.indexOf(d)))
    .replace(/[^0-9+]/g, '');
  if (raw.startsWith('+98')) raw = '0' + raw.slice(3);
  else if (raw.startsWith('0098')) raw = '0' + raw.slice(4);
  else if (raw.startsWith('98') && raw.length === 12) raw = '0' + raw.slice(2);
  raw = raw.replace(/[^0-9]/g, '');
  if (raw.length === 10 && raw.startsWith('9')) raw = '0' + raw;
  return raw;
}

/** Choose the contact's name and its first Iranian mobile number (falls back to the first number). */
export function extractContactFields(contact: RawContact | null | undefined): PickedContact | null {
  if (!contact) return null;
  const name = (contact.name || []).map((n) => (n || '').trim()).find(Boolean) || '';
  const phones = (contact.tel || []).map(normalizeContactPhone).filter(Boolean);
  const phone = phones.find((p) => /^09\d{9}$/.test(p)) || phones[0] || '';
  if (!name && !phone) return null;
  return { name, phone };
}

export function isContactPickerSupported(): boolean {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window;
}

/** Opens the native contact chooser. Returns null when the user cancels. */
export async function pickPhoneContact(): Promise<PickedContact | null> {
  const contacts = (navigator as unknown as {
    contacts: { select: (props: string[], opts: { multiple: boolean }) => Promise<RawContact[]> };
  }).contacts;
  const result = await contacts.select(['name', 'tel'], { multiple: false });
  return extractContactFields(result?.[0]);
}
