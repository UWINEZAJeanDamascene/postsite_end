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
/// <reference types="mongoose/types/schematypes" />
/// <reference types="mongoose/types/inferschematype" />
/// <reference types="mongoose/types/inferhydrateddoctype" />
/// <reference types="mongoose/types/inferrawdoctype" />
import mongoose, { Document, Model } from "mongoose";
export declare enum ActionType {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete",
    LOGIN = "login",
    LOGOUT = "logout",
    ASSIGN = "assign",
    UNASSIGN = "unassign",
    PRICE_UPDATE = "price_update",
    SYNC = "sync",
    EXPORT = "export",
    IMPORT = "import",
    VIEW = "view",
    OTHER = "other"
}
export declare enum ResourceType {
    SITE = "site",
    SITE_RECORD = "site_record",
    MAIN_STOCK = "main_stock",
    MATERIAL = "material",
    USER = "user",
    SYSTEM = "system",
    COMPANY = "company",
    PURCHASE_ORDER = "purchase_order",
    QUOTATION = "quotation"
}
export interface IActionLog {
    userId: mongoose.Types.ObjectId;
    userName: string;
    userEmail: string;
    userRole: string;
    companyId: string;
    action: ActionType;
    resource: ResourceType;
    resourceId?: string;
    resourceName?: string;
    description: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}
export interface IActionLogDocument extends IActionLog, Document {
}
export interface IActionLogModel extends Model<IActionLogDocument> {
    logAction(data: Omit<IActionLog, "timestamp">): Promise<IActionLogDocument>;
}
export declare const ActionLog: IActionLogModel;
export default ActionLog;
//# sourceMappingURL=ActionLog.d.ts.map