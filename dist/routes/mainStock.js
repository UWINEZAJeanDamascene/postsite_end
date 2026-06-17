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
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const server_1 = require("../websocket/server");
const MainStockRecord_1 = __importStar(require("../models/MainStockRecord"));
const StockMovement_1 = __importDefault(require("../models/StockMovement"));
const Site_1 = __importDefault(require("../models/Site"));
const actionLogService_1 = require("../services/actionLogService");
const ActionLog_1 = require("../models/ActionLog");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Get all main stock records (main stock manager only)
router.get('/', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { siteId, materialName, source, status, startDate, endDate, page = '1', limit = '10' } = req.query;
        const company_id = req.user.company_id;
        let where = { company_id };
        if (siteId)
            where.site_id = new mongoose_1.default.Types.ObjectId(siteId);
        if (materialName)
            where.materialName = { $regex: materialName, $options: 'i' };
        if (source && source !== 'all')
            where.source = source;
        if (status && status !== 'all')
            where.status = status;
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.$gte = new Date(startDate);
            if (endDate)
                where.date.$lte = new Date(endDate);
        }
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const recordsLimit = parseInt(limit);
        const records = await MainStockRecord_1.default.find(where)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(recordsLimit);
        const total = await MainStockRecord_1.default.countDocuments(where);
        const totalPages = Math.ceil(total / recordsLimit);
        res.json({
            records,
            total,
            page: parseInt(page),
            totalPages,
        });
    }
    catch (error) {
        console.error('Get main stock records error:', error);
        res.status(500).json({ error: 'Failed to fetch main stock records' });
    }
});
// Dashboard stats endpoint
router.get('/dashboard-stats', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const [pendingCount, activeSites, directRecords, totalStockValue] = await Promise.all([
            MainStockRecord_1.default.countDocuments({ company_id, status: MainStockRecord_1.RecordStatus.PENDING_PRICE }),
            // Count active sites for this company
            Site_1.default.countDocuments({ company_id, isActive: true }),
            MainStockRecord_1.default.countDocuments({
                company_id,
                source: MainStockRecord_1.RecordSource.DIRECT,
                date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
            }),
            MainStockRecord_1.default.aggregate([
                { $match: { company_id, totalValue: { $ne: null } } },
                { $group: { _id: null, total: { $sum: '$totalValue' } } }
            ]),
        ]);
        res.json({
            totalStockValue: totalStockValue[0]?.total || 0,
            pendingPricingCount: pendingCount,
            activeSitesCount: activeSites,
            directRecordsThisMonth: directRecords,
        });
    }
    catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});
// Top materials by quantity received
router.get('/top-materials', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const limit = parseInt(req.query.limit) || 10;
        const materials = await MainStockRecord_1.default.aggregate([
            { $match: { company_id } },
            { $group: { _id: '$materialName', quantityReceived: { $sum: '$quantityReceived' } } },
            { $sort: { quantityReceived: -1 } },
            { $limit: limit },
            { $project: { materialName: '$_id', quantityReceived: 1, _id: 0 } },
        ]);
        res.json(materials);
    }
    catch (error) {
        console.error('Top materials error:', error);
        res.status(500).json({ error: 'Failed to fetch top materials' });
    }
});
// Stock movements over time (for line chart)
router.get('/movements', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const days = parseInt(req.query.days) || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Get aggregated movements with material names
        const movements = await MainStockRecord_1.default.aggregate([
            { $match: { company_id, date: { $gte: startDate } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                    received: { $sum: '$quantityReceived' },
                    used: { $sum: '$quantityUsed' },
                    materials: { $push: { name: '$materialName', qty: '$quantityReceived' } },
                },
            },
            { $sort: { _id: 1 } },
            { $project: { date: '$_id', received: 1, used: 1, materials: 1, _id: 0 } },
        ]);
        // Fill in missing dates with zeros
        const result = [];
        for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(d.getDate() - (days - 1 - i));
            const dateStr = d.toISOString().split('T')[0];
            const existing = movements.find(m => m.date === dateStr);
            result.push({
                date: dateStr,
                received: existing?.received || 0,
                used: existing?.used || 0,
                materials: existing?.materials || [],
            });
        }
        res.json(result);
    }
    catch (error) {
        console.error('Stock movements error:', error);
        res.status(500).json({ error: 'Failed to fetch stock movements' });
    }
});
// Get single main stock record
router.get('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const record = await MainStockRecord_1.default.findById(id);
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        res.json(record);
    }
    catch (error) {
        console.error('Get main stock record error:', error);
        res.status(500).json({ error: 'Failed to fetch main stock record' });
    }
});
// Create direct main stock record (non-site purchase)
router.post('/direct', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { materialName, material_id, quantityReceived, quantityUsed, price, date, notes, } = req.body;
        if (!materialName || !date) {
            res.status(400).json({
                error: 'Material and date are required',
            });
            return;
        }
        // Calculate total value if price is provided
        const totalValue = price != null && quantityReceived != null
            ? price * quantityReceived
            : null;
        const record = new MainStockRecord_1.default({
            source: MainStockRecord_1.RecordSource.DIRECT,
            materialName,
            material_id: material_id ? new mongoose_1.default.Types.ObjectId(material_id) : undefined,
            quantityReceived: quantityReceived || 0,
            quantityUsed: quantityUsed || 0,
            price: price || null,
            totalValue,
            date: new Date(date),
            status: MainStockRecord_1.RecordStatus.DIRECT,
            notes,
            recordedBy: new mongoose_1.default.Types.ObjectId(req.user.id),
            company_id: req.user.company_id,
        });
        await record.save();
        // Log main stock record creation (pass minimal details)
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.MAIN_STOCK, `Created main stock record: ${record.materialName}`, {
            resourceId: record._id.toString(),
            resourceName: record.materialName,
            details: {
                quantityReceived: record.quantityReceived,
                quantityUsed: record.quantityUsed,
                price: record.price,
                totalValue: record.totalValue,
                date: record.date,
                notes: record.notes,
                source: record.source,
                siteId: record.site_id,
            },
        });
        // Broadcast update
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { mainStockRecord: record },
            timestamp: new Date(),
        });
        res.status(201).json(record);
    }
    catch (error) {
        console.error('Create main stock record error:', error);
        res.status(500).json({ error: 'Failed to create main stock record' });
    }
});
// Update price for a main stock record (PATCH endpoint for inline editing)
router.patch('/:id/price', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { price } = req.body;
        if (price === undefined || price === null || price < 0) {
            res.status(400).json({ error: 'Valid price is required' });
            return;
        }
        const record = await MainStockRecord_1.default.findById(id);
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        const previousPrice = record.price;
        const totalValue = price * record.quantityReceived;
        // Update the record
        record.price = price;
        record.totalValue = totalValue;
        // Update status if it was pending price
        if (record.status === MainStockRecord_1.RecordStatus.PENDING_PRICE) {
            record.status = MainStockRecord_1.RecordStatus.PRICED;
        }
        await record.save();
        // Log price update
        await actionLogService_1.ActionLogService.logPriceUpdate(req, record._id.toString(), record.materialName, previousPrice || null, price);
        // Broadcast update
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { mainStockRecord: record, priceUpdate: { previousPrice, newPrice: price } },
            timestamp: new Date(),
        });
        res.json(record);
    }
    catch (error) {
        console.error('Update price error:', error);
        res.status(500).json({ error: 'Failed to update price' });
    }
});
// Mark record as received (change status from DIRECT to PRICED)
router.patch('/:id/receive', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { price } = req.body;
        const record = await MainStockRecord_1.default.findById(id);
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        // Verify ownership
        if (record.company_id.toString() !== req.user.company_id) {
            res.status(403).json({ error: 'Not authorized to update this record' });
            return;
        }
        // Update status to PRICED
        record.status = MainStockRecord_1.RecordStatus.PRICED;
        // Optionally set price if provided
        if (price && price > 0) {
            record.price = price;
            record.totalValue = record.quantityReceived * price;
        }
        await record.save();
        // Log the action
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.MAIN_STOCK, `Marked record as received: ${record.materialName}`, {
            resourceId: record._id.toString(),
            resourceName: record.materialName,
        });
        // Broadcast update
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { mainStockRecord: record },
            timestamp: new Date(),
        });
        res.json(record);
    }
    catch (error) {
        console.error('Mark as received error:', error);
        res.status(500).json({ error: 'Failed to mark record as received' });
    }
});
// Update main stock record (full update)
router.put('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { materialName, quantityReceived, quantityUsed, price, date, status, notes, } = req.body;
        const record = await MainStockRecord_1.default.findById(id);
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        // Build updateData for logging
        const updateData = {};
        // Update fields and track what changed
        if (materialName) {
            record.materialName = materialName;
            updateData.materialName = materialName;
        }
        if (quantityReceived !== undefined) {
            record.quantityReceived = quantityReceived;
            updateData.quantityReceived = quantityReceived;
        }
        if (quantityUsed !== undefined) {
            record.quantityUsed = quantityUsed;
            updateData.quantityUsed = quantityUsed;
        }
        if (price !== undefined) {
            record.price = price;
            updateData.price = price;
        }
        if (status) {
            record.status = status;
            updateData.status = status;
        }
        if (notes !== undefined) {
            record.notes = notes;
            updateData.notes = notes;
        }
        if (date) {
            record.date = new Date(date);
            updateData.date = date;
        }
        // Recalculate total value
        if (record.price != null && record.quantityReceived != null) {
            record.totalValue = record.price * record.quantityReceived;
        }
        await record.save();
        // Log main stock record update
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.MAIN_STOCK, `Updated main stock record: ${record.materialName}`, {
            resourceId: record._id.toString(),
            resourceName: record.materialName,
            details: updateData,
        });
        // Broadcast update
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { mainStockRecord: record },
            timestamp: new Date(),
        });
        res.json(record);
    }
    catch (error) {
        console.error('Update main stock record error:', error);
        res.status(500).json({ error: 'Failed to update main stock record' });
    }
});
// Delete main stock record
router.delete('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const record = await MainStockRecord_1.default.findByIdAndDelete(id);
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        // Log main stock record deletion
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.DELETE, ActionLog_1.ResourceType.MAIN_STOCK, `Deleted main stock record: ${record.materialName}`, {
            resourceId: record._id.toString(),
            resourceName: record.materialName,
        });
        // Broadcast update - views will need to recalculate
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { deletedRecordId: id },
            timestamp: new Date(),
        });
        res.json({ message: 'Record deleted successfully' });
    }
    catch (error) {
        console.error('Delete main stock record error:', error);
        res.status(500).json({ error: 'Failed to delete main stock record' });
    }
});
// Get site-sourced records that need pricing (price is null)
router.get('/pending-pricing/all', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const records = await MainStockRecord_1.default.find({
            company_id,
            source: MainStockRecord_1.RecordSource.SITE,
            status: MainStockRecord_1.RecordStatus.PENDING_PRICE,
        })
            .sort({ createdAt: -1 })
            .populate('site_id', 'name');
        res.json(records);
    }
    catch (error) {
        console.error('Get pending pricing records error:', error);
        res.status(500).json({ error: 'Failed to fetch pending pricing records' });
    }
});
// Bulk add prices to site records
router.post('/bulk-price', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { updates } = req.body;
        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            res.status(400).json({ error: 'Updates array is required' });
            return;
        }
        const results = [];
        for (const { id, price } of updates) {
            const record = await MainStockRecord_1.default.findById(id);
            if (record) {
                const previousPrice = record.price ?? null;
                const quantityReceived = record.quantityReceived || 0;
                const totalValue = price * quantityReceived;
                record.price = price;
                record.totalValue = totalValue;
                record.status = MainStockRecord_1.RecordStatus.PRICED;
                await record.save();
                // Log individual price update
                await actionLogService_1.ActionLogService.logPriceUpdate(req, record._id.toString(), record.materialName, previousPrice, price);
                results.push({ id, price, totalValue });
            }
        }
        // Broadcast bulk update
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { bulkPriceUpdate: results },
            timestamp: new Date(),
        });
        res.json({ message: 'Prices updated successfully', updated: results.length });
    }
    catch (error) {
        console.error('Bulk price update error:', error);
        res.status(500).json({ error: 'Failed to update prices' });
    }
});
// Get stock movements for a specific record
router.get('/:id/movements', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const idStr = Array.isArray(id) ? id[0] : id;
        const movements = await StockMovement_1.default.find({
            mainStock_id: new mongoose_1.default.Types.ObjectId(idStr),
        }).sort({ date: -1 });
        res.json(movements);
    }
    catch (error) {
        console.error('Get stock movements error:', error);
        res.status(500).json({ error: 'Failed to fetch stock movements' });
    }
});
exports.default = router;
//# sourceMappingURL=mainStock.js.map