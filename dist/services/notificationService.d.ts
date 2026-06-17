/// <reference types="mongoose/types/aggregate" />
/// <reference types="mongoose/types/callback" />
/// <reference types="mongoose/types/collection" />
/// <reference types="mongoose/types/connection" />
/// <reference types="mongoose/types/cursor" />
/// <reference types="mongoose/types/document" />
/// <reference types="mongoose/types/error" />
/// <reference types="mongoose/types/expressions" />
/// <reference types="mongoose/types/helpers" />
/// <reference types="mongoose/types/middlewares" />
/// <reference types="mongoose/types/indexes" />
/// <reference types="mongoose/types/models" />
/// <reference types="mongoose/types/mongooseoptions" />
/// <reference types="mongoose/types/pipelinestage" />
/// <reference types="mongoose/types/populate" />
/// <reference types="mongoose/types/query" />
/// <reference types="mongoose/types/schemaoptions" />
/// <reference types="mongoose/types/session" />
/// <reference types="mongoose/types/types" />
/// <reference types="mongoose/types/utility" />
/// <reference types="mongoose/types/validation" />
/// <reference types="mongoose/types/virtuals" />
/// <reference types="mongoose" />
/// <reference types="mongoose/types/schematypes" />
/// <reference types="mongoose/types/inferschematype" />
/// <reference types="mongoose/types/inferhydrateddoctype" />
/// <reference types="mongoose/types/inferrawdoctype" />
export declare class NotificationService {
    static notifyMaterialReceived(userId: string, materialName: string, quantity: number, siteName?: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifyMaterialUsed(userId: string, materialName: string, quantity: number, siteName?: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifyLowStock(userId: string, materialName: string, remainingQuantity: number, threshold?: number): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifySiteCreated(userId: string, siteName: string, location: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifyPriceUpdated(userId: string, materialName: string, oldPrice: number, newPrice: number): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifyRecordReceived(userId: string, materialName: string, status: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifySystem(userId: string, title: string, message: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
}
export default NotificationService;
//# sourceMappingURL=notificationService.d.ts.map