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
exports.StockMovement = exports.MovementType = void 0;
const mongoose_1 = __importStar(require("mongoose"));
var MovementType;
(function (MovementType) {
    MovementType["RECEIVED"] = "received";
    MovementType["USED"] = "used";
    MovementType["ADJUSTMENT"] = "adjustment";
})(MovementType || (exports.MovementType = MovementType = {}));
const StockMovementSchema = new mongoose_1.Schema({
    mainStockRecord_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'MainStockRecord',
        required: true,
        index: true,
    },
    site_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Site',
    },
    material_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Material',
    },
    movementType: {
        type: String,
        enum: Object.values(MovementType),
        required: true,
    },
    quantity: { type: Number, required: true },
    previousQuantityUsed: { type: Number, required: true },
    previousQuantityReceived: { type: Number, required: true },
    newQuantityUsed: { type: Number, required: true },
    newQuantityReceived: { type: Number, required: true },
    performedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    company_id: { type: String, required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String },
}, { timestamps: true });
// Compound indexes
StockMovementSchema.index({ company_id: 1, mainStockRecord_id: 1 });
StockMovementSchema.index({ company_id: 1, material_id: 1 });
StockMovementSchema.index({ company_id: 1, date: -1 });
exports.StockMovement = mongoose_1.default.model('StockMovement', StockMovementSchema);
exports.default = exports.StockMovement;
//# sourceMappingURL=StockMovement.js.map