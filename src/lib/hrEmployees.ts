import { toEnglishDigits } from './numberParsing';

export type HREmployeeStatus = 'active' | 'pending_registration' | 'inactive';

export interface HRSearchable {
  full_name: string;
  phone_number: string | null;
  position: string | null;
  department: string | null;
}

/** Normalize Persian/Arabic text so «ي/ك» and digits match their Persian/English forms. */
function normalize(text: string): string {
  return toEnglishDigits(text)
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Normalize a typed phone number: Persian digits → English, keep digits only, +98/98 → 0. */
export function normalizeHRPhone(input: string): string {
  let digits = toEnglishDigits(input).replace(/\D/g, '');
  if (digits.startsWith('98') && digits.length === 12) digits = '0' + digits.slice(2);
  if (digits.length === 10 && digits.startsWith('9')) digits = '0' + digits;
  return digits.slice(0, 11);
}

export function isValidHRPhone(phone: string): boolean {
  return /^09[0-9]{9}$/.test(phone);
}

/** Match an employee against a search query by name, phone number, position or department. */
export function matchesHRSearch(employee: HRSearchable, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const qDigits = q.replace(/\D/g, '');
  if (qDigits && qDigits.length === q.replace(/\s/g, '').length) {
    const phone = (employee.phone_number || '').replace(/\D/g, '');
    if (phone.includes(qDigits)) return true;
  }
  const haystack = normalize(
    [employee.full_name, employee.phone_number, employee.position, employee.department]
      .filter(Boolean)
      .join(' '),
  );
  return q.split(' ').every((part) => haystack.includes(part));
}

/**
 * Status after editing an employee: a manually deactivated employee stays inactive;
 * otherwise an employee without a phone or with a registered account is active,
 * and one whose phone has no account yet waits for registration.
 */
export function resolveHRStatus(
  chosen: HREmployeeStatus,
  phone: string | null,
  linkedUserId: string | null,
): HREmployeeStatus {
  if (chosen === 'inactive') return 'inactive';
  if (!phone || linkedUserId) return 'active';
  return 'pending_registration';
}
