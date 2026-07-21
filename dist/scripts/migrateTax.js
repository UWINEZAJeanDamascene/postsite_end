"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma_1 = __importDefault(require("../config/prisma"));
async function migrateTax() {
    try {
        console.log('This migration script is no longer needed for the Prisma-backed database.');
        const [purchaseOrders, deliveryNotes] = await Promise.all([
            prisma_1.default.purchaseOrder.findMany({ where: { taxRate: { gt: 0 }, taxAmount: 0 } }),
            prisma_1.default.deliveryNote.findMany({ where: { taxRate: { gt: 0 }, taxAmount: 0 } }),
        ]);
        console.log(`Found ${purchaseOrders.length} purchase orders and ${deliveryNotes.length} delivery notes to review.`);
        console.log('No automatic tax recalculation is performed here; values should be recomputed through the application flow.');
        process.exit(0);
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
migrateTax();
//# sourceMappingURL=migrateTax.js.map