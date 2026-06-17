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
import mongoose, { Document, Model } from 'mongoose';
export declare enum UserRole {
    MAIN_MANAGER = "main_manager",
    SITE_MANAGER = "site_manager",
    ACCOUNTANT = "accountant",
    MANAGER = "manager"
}
export interface IUser {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    assignedSites: mongoose.Types.ObjectId[];
    company_id: string;
    isActive: boolean;
    profilePicture?: string;
    phone?: string;
    department?: string;
    jobTitle?: string;
    bio?: string;
    location?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface IUserDocument extends IUser, Document {
    comparePassword(candidatePassword: string): Promise<boolean>;
    isModified(path: string): boolean;
}
export interface IUserModel extends Model<IUserDocument> {
}
export declare const User: IUserModel;
export default User;
//# sourceMappingURL=User.d.ts.map