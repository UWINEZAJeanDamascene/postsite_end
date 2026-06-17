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
exports.createNotification = exports.Notification = exports.NotificationPriority = exports.NotificationType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var NotificationType;
(function (NotificationType) {
    NotificationType["MATERIAL_RECEIVED"] = "MATERIAL_RECEIVED";
    NotificationType["MATERIAL_USED"] = "MATERIAL_USED";
    NotificationType["MATERIAL_LOW_STOCK"] = "MATERIAL_LOW_STOCK";
    NotificationType["SITE_CREATED"] = "SITE_CREATED";
    NotificationType["SITE_UPDATED"] = "SITE_UPDATED";
    NotificationType["PRICE_UPDATED"] = "PRICE_UPDATED";
    NotificationType["RECORD_RECEIVED"] = "RECORD_RECEIVED";
    NotificationType["SYSTEM"] = "SYSTEM";
})(NotificationType || (exports.NotificationType = NotificationType = {}));
var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["LOW"] = "LOW";
    NotificationPriority["MEDIUM"] = "MEDIUM";
    NotificationPriority["HIGH"] = "HIGH";
})(NotificationPriority || (exports.NotificationPriority = NotificationPriority = {}));
const NotificationSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: Object.values(NotificationType),
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    priority: {
        type: String,
        enum: Object.values(NotificationPriority),
        default: NotificationPriority.MEDIUM,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    data: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    link: {
        type: String,
    },
}, { timestamps: true });
// Index for efficient querying
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
exports.Notification = mongoose_1.default.model('Notification', NotificationSchema);
// Static method to create notification
const createNotification = async (data) => {
    try {
        const notification = new exports.Notification(data);
        await notification.save();
        return notification;
    }
    catch (error) {
        console.error('Failed to create notification:', error);
        return null;
    }
};
exports.createNotification = createNotification;
exports.default = exports.Notification;
//# sourceMappingURL=Notification.js.map