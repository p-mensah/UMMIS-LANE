/**
 * Privacy & Data Protection Utility
 * Masks sensitive customer personal data (phone numbers and email addresses)
 * when viewed by Store Staff role accounts.
 */

export function maskPhone(phone: string | null | undefined): string {
  if (!phone || phone.trim() === '') return '';
  const clean = phone.trim();
  const digits = clean.replace(/\D/g, '');
  if (digits.length >= 4) {
    const last4 = digits.slice(-4);
    return `***-***-${last4}`;
  }
  return '***-***-****';
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || email.trim() === '') return '';
  const clean = email.trim();
  const atIndex = clean.indexOf('@');
  if (atIndex <= 0) return '***@***.com';

  const username = clean.slice(0, atIndex);
  const domain = clean.slice(atIndex + 1);

  const firstChar = username.charAt(0);
  return `${firstChar}***@${domain}`;
}

export function getDisplayCustomerPhone(phone: string | null | undefined, userRole?: string): string {
  if (!phone) return '';
  if (userRole === 'staff') {
    return maskPhone(phone);
  }
  return phone;
}

export function getDisplayCustomerEmail(email: string | null | undefined, userRole?: string): string {
  if (!email) return '';
  if (userRole === 'staff') {
    return maskEmail(email);
  }
  return email;
}
