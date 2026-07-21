"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const datasourceUrl = process.env.NODE_ENV === 'test'
    ? process.env.TEST_POSTGRES_URL || process.env.POSTGRES_URL
    : process.env.POSTGRES_URL;
const prisma = global.prisma || new client_1.PrismaClient(datasourceUrl
    ? {
        datasources: {
            db: {
                url: datasourceUrl,
            },
        },
    }
    : undefined);
if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}
exports.default = prisma;
//# sourceMappingURL=client.js.map