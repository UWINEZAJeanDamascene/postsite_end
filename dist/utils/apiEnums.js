"use strict";
/**
 * Map between Prisma UPPER_SNAKE enums and frontend lower_snake API values.
 * Quotation/Invoice statuses are already lowercase in Prisma and pass through unchanged.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPrismaStatus = exports.toApiStatus = exports.toPrismaEnum = exports.toApiEnum = void 0;
function toApiEnum(value) {
    if (value == null)
        return null;
    return value.toLowerCase();
}
exports.toApiEnum = toApiEnum;
function toPrismaEnum(value) {
    if (value == null || value === '' || value === 'all')
        return undefined;
    return value.toUpperCase();
}
exports.toPrismaEnum = toPrismaEnum;
function toApiStatus(value) {
    return String(value).toLowerCase();
}
exports.toApiStatus = toApiStatus;
function toPrismaStatus(value) {
    return value.toUpperCase();
}
exports.toPrismaStatus = toPrismaStatus;
//# sourceMappingURL=apiEnums.js.map