/**
 * Canonical alert timestamp formatter adhering to repository timezone policy:
 * - Default timezone: Asia/Jakarta (WIB, UTC+7).
 * - Honors recipient/user preference timezone when configured and valid.
 * - Safely falls back to Asia/Jakarta on invalid or empty timezone strings.
 * - Preserves UTC storage in database without manual 7-hour arithmetic.
 * - Formats with consistent medium date and time style per locale.
 */
export function formatAlertTimestamp(
  dateInput: Date | string | null | undefined,
  locale: string = 'id',
  timezone?: string | null
): string {
  if (!dateInput) return '';

  const isId = (locale || 'id').toLowerCase().startsWith('id');
  const dateObj = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(dateObj.getTime())) return '';

  const requestedTimezone = timezone?.trim();
  const targetTimezone = requestedTimezone || 'Asia/Jakarta';

  try {
    return dateObj.toLocaleString(isId ? 'id-ID' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: targetTimezone,
    });
  } catch {
    // Graceful fallback to Asia/Jakarta on invalid IANA timezone string
    return dateObj.toLocaleString(isId ? 'id-ID' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
      timeZone: 'Asia/Jakarta',
    });
  }
}
