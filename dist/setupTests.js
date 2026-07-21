"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./config/prisma"));
jest.setTimeout(30000);
beforeAll(async () => {
    await prisma_1.default.$connect();
});
afterEach(async () => {
    // Clean up created test data in reverse dependency order
    await prisma_1.default.actionLog.deleteMany({});
    await prisma_1.default.notification.deleteMany({});
    await prisma_1.default.stockMovement.deleteMany({});
    await prisma_1.default.mainStockRecord.deleteMany({});
    await prisma_1.default.siteRecord.deleteMany({});
    await prisma_1.default.siteAssignment.deleteMany({});
    await prisma_1.default.site.deleteMany({});
    await prisma_1.default.user.deleteMany({});
    await prisma_1.default.company.deleteMany({});
});
afterAll(async () => {
    await prisma_1.default.$disconnect();
});
//# sourceMappingURL=setupTests.js.map