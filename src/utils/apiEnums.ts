/**
 * Map between Prisma UPPER_SNAKE enums and frontend lower_snake API values.
 * Quotation/Invoice statuses are already lowercase in Prisma and pass through unchanged.
 */

export function toApiEnum(value: string | null | undefined): string | null {
  if (value == null) return null;
  return value.toLowerCase();
}

export function toPrismaEnum(value: string | null | undefined): string | undefined {
  if (value == null || value === '' || value === 'all') return undefined;
  return value.toUpperCase();
}

export function toApiStatus<T extends string>(value: T): string {
  return String(value).toLowerCase();
}

export function toPrismaStatus(value: string): string {
  return value.toUpperCase();
}
