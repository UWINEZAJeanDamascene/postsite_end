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
exports.Material = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const MaterialSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    unit: { type: String, required: true }, // e.g., kg, litres, pcs
    description: { type: String },
    company_id: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
// Index for company-scoped queries
MaterialSchema.index({ company_id: 1, name: 1 });
exports.Material = mongoose_1.default.model('Material', MaterialSchema);
exports.default = exports.Material;
//# sourceMappingURL=Material.js.map