/**
 * Map between Prisma UPPER_SNAKE enums and frontend lower_snake API values.
 * Quotation/Invoice statuses are already lowercase in Prisma and pass through unchanged.
 */
export declare function toApiEnum(value: string | null | undefined): string | null;
export declare function toPrismaEnum(value: string | null | undefined): string | undefined;
export declare function toApiStatus<T extends string>(value: T): string;
export declare function toPrismaStatus(value: string): string;
//# sourceMappingURL=apiEnums.d.ts.map