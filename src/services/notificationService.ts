import {
  NotificationPriority,
  NotificationType,
  type Prisma,
} from '@prisma/client';
import prisma from '../config/prisma';

async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  data?: Prisma.InputJsonValue;
  link?: string;
}) {
  try {
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        priority: data.priority ?? NotificationPriority.MEDIUM,
        data: data.data,
        link: data.link,
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

export class NotificationService {
  static async notifyMaterialReceived(
    userId: string,
    materialName: string,
    quantity: number,
    siteName?: string
  ) {
    return createNotification({
      userId,
      type: NotificationType.MATERIAL_RECEIVED,
      title: 'Material Received',
      message: `${materialName} - ${quantity} units received${siteName ? ` at ${siteName}` : ''}`,
      priority: NotificationPriority.MEDIUM,
      data: { materialName, quantity, siteName },
    });
  }

  static async notifyMaterialUsed(
    userId: string,
    materialName: string,
    quantity: number,
    siteName?: string
  ) {
    return createNotification({
      userId,
      type: NotificationType.MATERIAL_USED,
      title: 'Material Used',
      message: `${materialName} - ${quantity} units used${siteName ? ` at ${siteName}` : ''}`,
      priority: NotificationPriority.MEDIUM,
      data: { materialName, quantity, siteName },
    });
  }

  static async notifyLowStock(
    userId: string,
    materialName: string,
    remainingQuantity: number,
    threshold?: number
  ) {
    return createNotification({
      userId,
      type: NotificationType.MATERIAL_LOW_STOCK,
      title: 'Low Stock Alert',
      message: `${materialName} has only ${remainingQuantity} units remaining${threshold ? ` (below threshold of ${threshold})` : ''}`,
      priority: NotificationPriority.HIGH,
      data: { materialName, remainingQuantity, threshold },
    });
  }

  static async notifySiteCreated(userId: string, siteName: string, location: string) {
    return createNotification({
      userId,
      type: NotificationType.SITE_CREATED,
      title: 'New Site Created',
      message: `${siteName} has been created in ${location}`,
      priority: NotificationPriority.LOW,
      data: { siteName, location },
    });
  }

  static async notifyPriceUpdated(
    userId: string,
    materialName: string,
    oldPrice: number,
    newPrice: number
  ) {
    return createNotification({
      userId,
      type: NotificationType.PRICE_UPDATED,
      title: 'Price Updated',
      message: `${materialName} price changed from RWF ${oldPrice} to RWF ${newPrice}`,
      priority: NotificationPriority.MEDIUM,
      data: { materialName, oldPrice, newPrice },
    });
  }

  static async notifyRecordReceived(
    userId: string,
    materialName: string,
    status: string
  ) {
    return createNotification({
      userId,
      type: NotificationType.RECORD_RECEIVED,
      title: 'Record Status Updated',
      message: `${materialName} has been marked as ${status}`,
      priority: NotificationPriority.LOW,
      data: { materialName, status },
    });
  }

  static async notifySystem(userId: string, title: string, message: string) {
    return createNotification({
      userId,
      type: NotificationType.SYSTEM,
      title,
      message,
      priority: NotificationPriority.MEDIUM,
    });
  }
}

export default NotificationService;
