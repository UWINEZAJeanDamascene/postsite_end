import { type Prisma } from '@prisma/client';
export declare class NotificationService {
    static notifyMaterialReceived(userId: string, materialName: string, quantity: number, siteName?: string): Promise<{
        link: string | null;
        message: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        data: Prisma.JsonValue;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        priority: import(".prisma/client").$Enums.NotificationPriority;
        isRead: boolean;
    } | null>;
    static notifyMaterialUsed(userId: string, materialName: string, quantity: number, siteName?: string): Promise<{
        link: string | null;
        message: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        data: Prisma.JsonValue;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        priority: import(".prisma/client").$Enums.NotificationPriority;
        isRead: boolean;
    } | null>;
    static notifyLowStock(userId: string, materialName: string, remainingQuantity: number, threshold?: number): Promise<{
        link: string | null;
        message: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        data: Prisma.JsonValue;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        priority: import(".prisma/client").$Enums.NotificationPriority;
        isRead: boolean;
    } | null>;
    static notifySiteCreated(userId: string, siteName: string, location: string): Promise<{
        link: string | null;
        message: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        data: Prisma.JsonValue;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        priority: import(".prisma/client").$Enums.NotificationPriority;
        isRead: boolean;
    } | null>;
    static notifyPriceUpdated(userId: string, materialName: string, oldPrice: number, newPrice: number): Promise<{
        link: string | null;
        message: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        data: Prisma.JsonValue;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        priority: import(".prisma/client").$Enums.NotificationPriority;
        isRead: boolean;
    } | null>;
    static notifyRecordReceived(userId: string, materialName: string, status: string): Promise<{
        link: string | null;
        message: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        data: Prisma.JsonValue;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        priority: import(".prisma/client").$Enums.NotificationPriority;
        isRead: boolean;
    } | null>;
    static notifySystem(userId: string, title: string, message: string): Promise<{
        link: string | null;
        message: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        data: Prisma.JsonValue;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        priority: import(".prisma/client").$Enums.NotificationPriority;
        isRead: boolean;
    } | null>;
}
export default NotificationService;
//# sourceMappingURL=notificationService.d.ts.map