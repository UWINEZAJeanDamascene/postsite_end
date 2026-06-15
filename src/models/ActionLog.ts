import mongoose, { Schema, Document, Model } from "mongoose";

export enum ActionType {
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
  OTHER = "other",
}

export enum ResourceType {
  SITE = "site",
  SITE_RECORD = "site_record",
  MAIN_STOCK = "main_stock",
  MATERIAL = "material",
  USER = "user",
  SYSTEM = "system",
  COMPANY = "company",
  PURCHASE_ORDER = "purchase_order",
  QUOTATION = "quotation",
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

export interface IActionLogDocument extends IActionLog, Document {}

export interface IActionLogModel extends Model<IActionLogDocument> {
  logAction(data: Omit<IActionLog, "timestamp">): Promise<IActionLogDocument>;
}

const ActionLogSchema = new Schema<IActionLogDocument, IActionLogModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
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
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false, // We use custom timestamp field
  },
);

// Compound indexes for efficient querying
ActionLogSchema.index({ companyId: 1, timestamp: -1 });
ActionLogSchema.index({ companyId: 1, userId: 1, timestamp: -1 });
ActionLogSchema.index({ companyId: 1, action: 1, timestamp: -1 });
ActionLogSchema.index({ companyId: 1, resource: 1, timestamp: -1 });

// Static method to create action log
ActionLogSchema.statics.logAction = async function (
  data: Omit<IActionLog, "timestamp">,
): Promise<IActionLogDocument> {
  return this.create({ ...data, timestamp: new Date() });
};

export const ActionLog = mongoose.model<IActionLogDocument, IActionLogModel>(
  "ActionLog",
  ActionLogSchema,
);
export default ActionLog;
