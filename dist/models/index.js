"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordStatus = exports.RecordSource = exports.UserRole = exports.ResourceType = exports.ActionType = void 0;
/**
 * Compatibility re-exports. Runtime data access uses Prisma (`src/config/prisma`).
 * Prefer importing ActionType/ResourceType from `services/actionLogService`
 * and UserRole from `types`.
 */
var actionLogService_1 = require("../services/actionLogService");
Object.defineProperty(exports, "ActionType", { enumerable: true, get: function () { return actionLogService_1.ActionType; } });
Object.defineProperty(exports, "ResourceType", { enumerable: true, get: function () { return actionLogService_1.ResourceType; } });
var types_1 = require("../types");
Object.defineProperty(exports, "UserRole", { enumerable: true, get: function () { return types_1.UserRole; } });
Object.defineProperty(exports, "RecordSource", { enumerable: true, get: function () { return types_1.RecordSource; } });
Object.defineProperty(exports, "RecordStatus", { enumerable: true, get: function () { return types_1.RecordStatus; } });
//# sourceMappingURL=index.js.map