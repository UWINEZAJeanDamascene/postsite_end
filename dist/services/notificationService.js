"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = __importDefault(require("../config/prisma"));
async function createNotification(data) {
    try {
        return await prisma_1.default.notification.create({
            data: {
                userId: data.userId,
                type: data.type,
                title: data.title,
                message: data.message,
                priority: data.priority ?? client_1.NotificationPriority.MEDIUM,
                data: data.data,
                link: data.link,
            },
        });
    }
    catch (error) {
        console.error('Failed to create notification:', error);
        return null;
    }
}
class NotificationService {
    static async notifyMaterialReceived(userId, materialName, quantity, siteName) {
        return createNotification({
            userId,
            type: client_1.NotificationType.MATERIAL_RECEIVED,
            title: 'Material Received',
            message: `${materialName} - ${quantity} units received${siteName ? ` at ${siteName}` : ''}`,
            priority: client_1.NotificationPriority.MEDIUM,
            data: { materialName, quantity, siteName },
        });
    }
    static async notifyMaterialUsed(userId, materialName, quantity, siteName) {
        return createNotification({
            userId,
            type: client_1.NotificationType.MATERIAL_USED,
            title: 'Material Used',
            message: `${materialName} - ${quantity} units used${siteName ? ` at ${siteName}` : ''}`,
            priority: client_1.NotificationPriority.MEDIUM,
            data: { materialName, quantity, siteName },
        });
    }
    static async notifyLowStock(userId, materialName, remainingQuantity, threshold) {
        return createNotification({
            userId,
            type: client_1.NotificationType.MATERIAL_LOW_STOCK,
            title: 'Low Stock Alert',
            message: `${materialName} has only ${remainingQuantity} units remaining${threshold ? ` (below threshold of ${threshold})` : ''}`,
            priority: client_1.NotificationPriority.HIGH,
            data: { materialName, remainingQuantity, threshold },
        });
    }
    static async notifySiteCreated(userId, siteName, location) {
        return createNotification({
            userId,
            type: client_1.NotificationType.SITE_CREATED,
            title: 'New Site Created',
            message: `${siteName} has been created in ${location}`,
            priority: client_1.NotificationPriority.LOW,
            data: { siteName, location },
        });
    }
    static async notifyPriceUpdated(userId, materialName, oldPrice, newPrice) {
        return createNotification({
            userId,
            type: client_1.NotificationType.PRICE_UPDATED,
            title: 'Price Updated',
            message: `${materialName} price changed from $${oldPrice} to $${newPrice}`,
            priority: client_1.NotificationPriority.MEDIUM,
            data: { materialName, oldPrice, newPrice },
        });
    }
    static async notifyRecordReceived(userId, materialName, status) {
        return createNotification({
            userId,
            type: client_1.NotificationType.RECORD_RECEIVED,
            title: 'Record Status Updated',
            message: `${materialName} has been marked as ${status}`,
            priority: client_1.NotificationPriority.LOW,
            data: { materialName, status },
        });
    }
    static async notifySystem(userId, title, message) {
        return createNotification({
            userId,
            type: client_1.NotificationType.SYSTEM,
            title,
            message,
            priority: client_1.NotificationPriority.MEDIUM,
        });
    }
}
exports.NotificationService = NotificationService;
exports.default = NotificationService;
//# sourceMappingURL=notificationService.js.map