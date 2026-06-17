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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = exports.UserRole = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
var UserRole;
(function (UserRole) {
    UserRole["MAIN_MANAGER"] = "main_manager";
    UserRole["SITE_MANAGER"] = "site_manager";
    UserRole["ACCOUNTANT"] = "accountant";
    UserRole["MANAGER"] = "manager";
})(UserRole || (exports.UserRole = UserRole = {}));
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
        type: String,
        enum: Object.values(UserRole),
        required: true,
    },
    assignedSites: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Site',
        }],
    company_id: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },
    // Profile fields
    profilePicture: { type: String },
    phone: { type: String },
    department: { type: String },
    jobTitle: { type: String },
    bio: { type: String },
    location: { type: String },
}, { timestamps: true });
// Index for company-scoped queries
UserSchema.index({ company_id: 1, email: 1 });
UserSchema.index({ company_id: 1, role: 1 });
// Hash password before saving (work factor 10 for faster login)
UserSchema.pre('save', async function () {
    console.log('Pre-save hook - isModified(password):', this.isModified('password'));
    console.log('Pre-save hook - password value:', this.password?.substring(0, 10) + '...');
    if (!this.isModified('password')) {
        console.log('Pre-save hook - password not modified, skipping hash');
        return;
    }
    console.log('Pre-save hook - hashing password...');
    const salt = await bcryptjs_1.default.genSalt(10);
    this.password = await bcryptjs_1.default.hash(this.password, salt);
    console.log('Pre-save hook - password hashed successfully');
});
// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
    return bcryptjs_1.default.compare(candidatePassword, this.password);
};
exports.User = mongoose_1.default.model('User', UserSchema);
exports.default = exports.User;
//# sourceMappingURL=User.js.map