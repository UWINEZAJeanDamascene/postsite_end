"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionLog = exports.ResourceType = exports.ActionType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var ActionType;
(function (ActionType) {
    ActionType["CREATE"] = "create";
    ActionType["UPDATE"] = "update";
    ActionType["DELETE"] = "delete";
    ActionType["LOGIN"] = "login";
    ActionType["LOGOUT"] = "logout";
    ActionType["ASSIGN"] = "assign";
    ActionType["UNASSIGN"] = "unassign";
    ActionType["PRICE_UPDATE"] = "price_update";
    ActionType["SYNC"] = "sync";
    ActionType["EXPORT"] = "export";
    ActionType["IMPORT"] = "import";
    ActionType["VIEW"] = "view";
    ActionType["OTHER"] = "other";
})(ActionType || (exports.ActionType = ActionType = {}));
var ResourceType;
(function (ResourceType) {
    ResourceType["SITE"] = "site";
    ResourceType["SITE_RECORD"] = "site_record";
    ResourceType["MAIN_STOCK"] = "main_stock";
    ResourceType["MATERIAL"] = "material";
    ResourceType["USER"] = "user";
    ResourceType["SYSTEM"] = "system";
    ResourceType["COMPANY"] = "company";
    ResourceType["PURCHASE_ORDER"] = "purchase_order";
    ResourceType["QUOTATION"] = "quotation";
    ResourceType["CLIENT"] = "client";
})(ResourceType || (exports.ResourceType = ResourceType = {}));
const ActionLogSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    userEmail: { type: String, required: true },
    userRole: { type: String, required: true },
    companyId: { type: String, required: true, index: true },
    action: {
        type: String,
        enum: Object.values(ActionType),
        required: true,
        index: true,
    },
    resource: {
        type: String,
        enum: Object.values(ResourceType),
        required: true,
        index: true,
    },
    resourceId: { type: String },
    resourceName: { type: String },
    description: { type: String, required: true },
    details: { type: mongoose_1.Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
}, {
    timestamps: false, // We use custom timestamp field
});
// Compound indexes for efficient querying
ActionLogSchema.index({ companyId: 1, timestamp: -1 });
ActionLogSchema.index({ companyId: 1, userId: 1, timestamp: -1 });
ActionLogSchema.index({ companyId: 1, action: 1, timestamp: -1 });
ActionLogSchema.index({ companyId: 1, resource: 1, timestamp: -1 });
// Static method to create action log
ActionLogSchema.statics.logAction = async function (data) {
    return this.create({ ...data, timestamp: new Date() });
};
exports.ActionLog = mongoose_1.default.model("ActionLog", ActionLogSchema);
exports.default = exports.ActionLog;
//# sourceMappingURL=ActionLog.js.map