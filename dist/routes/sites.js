"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const types_1 = require("../types");
const models_1 = require("../models");
const actionLogService_1 = require("../services/actionLogService");
const notificationService_1 = require("../services/notificationService");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Get all sites (main manager sees all company sites, site manager sees assigned)
router.get("/", auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        let sites;
        const managementRoles = [
            types_1.UserRole.MAIN_MANAGER,
            types_1.UserRole.ACCOUNTANT,
            types_1.UserRole.MANAGER,
        ];
        if (managementRoles.includes(req.user.role)) {
            sites = await models_1.Site.find({ company_id });
        }
        else {
            // Site manager only sees their assigned sites
            const assignedIds = req.assignedSiteIds?.map((id) => new mongoose_1.default.Types.ObjectId(id)) || [];
            sites = await models_1.Site.find({
                company_id,
                _id: { $in: assignedIds },
            });
        }
        res.json(sites.map((site) => ({
            _id: site._id.toString(),
            name: site.name,
            location: site.location,
            description: site.description,
            company_id: site.company_id,
            isActive: site.isActive,
            createdBy: site.createdBy.toString(),
            createdAt: site.createdAt,
        })));
    }
    catch (error) {
        console.error("Get sites error:", error);
        res.status(500).json({ error: "Failed to fetch sites" });
    }
});
// Get single site
router.get("/:id", auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        // Check access for site managers
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            const hasAccess = req.assignedSiteIds?.includes(id);
            if (!hasAccess) {
                res.status(403).json({ error: "Access denied to this site" });
                return;
            }
        }
        const site = await models_1.Site.findOne({
            _id: new mongoose_1.default.Types.ObjectId(id),
            company_id,
        });
        if (!site) {
            res.status(404).json({ error: "Site not found" });
            return;
        }
        res.json({
            id: site._id.toString(),
            name: site.name,
            location: site.location,
            description: site.description,
            company_id: site.company_id,
            isActive: site.isActive,
            createdBy: site.createdBy.toString(),
            createdAt: site.createdAt,
        });
    }
    catch (error) {
        console.error("Get site error:", error);
        res.status(500).json({ error: "Failed to fetch site" });
    }
});
// Create site (main manager only)
router.post("/", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { name, location, description } = req.body;
        const company_id = req.user.company_id;
        if (!name) {
            res.status(400).json({ error: "Site name is required" });
            return;
        }
        const site = await models_1.Site.create({
            name,
            location,
            description,
            company_id,
            createdBy: new mongoose_1.default.Types.ObjectId(req.user.id),
            isActive: true,
        });
        // Log site creation
        await actionLogService_1.ActionLogService.logSiteCreate(req, site._id.toString(), site.name);
        // Create notification for site creation
        await notificationService_1.NotificationService.notifySiteCreated(req.user.id, site.name, site.location || "Unknown location");
        res.status(201).json({
            id: site._id.toString(),
            name: site.name,
            location: site.location,
            description: site.description,
            company_id: site.company_id,
            isActive: site.isActive,
            createdBy: site.createdBy.toString(),
            createdAt: site.createdAt,
        });
    }
    catch (error) {
        console.error("Create site error:", error);
        res.status(500).json({ error: "Failed to create site" });
    }
});
// Update site (main manager only)
router.put("/:id", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, location, description, isActive } = req.body;
        const company_id = req.user.company_id;
        const updateData = {};
        if (name)
            updateData.name = name;
        if (location !== undefined)
            updateData.location = location;
        if (description !== undefined)
            updateData.description = description;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        const site = await models_1.Site.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(id), company_id }, { $set: updateData }, { returnDocument: "after" });
        if (!site) {
            res.status(404).json({ error: "Site not found" });
            return;
        }
        // Log site update
        await actionLogService_1.ActionLogService.logSiteUpdate(req, site._id.toString(), site.name);
        res.json({
            id: site._id.toString(),
            name: site.name,
            location: site.location,
            description: site.description,
            company_id: site.company_id,
            isActive: site.isActive,
            createdBy: site.createdBy.toString(),
            createdAt: site.createdAt,
        });
    }
    catch (error) {
        console.error("Update site error:", error);
        res.status(500).json({ error: "Failed to update site" });
    }
});
// Get site details with stats and records
router.get("/:id/details", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const siteId = new mongoose_1.default.Types.ObjectId(id);
        const site = await models_1.Site.findOne({ _id: siteId, company_id });
        if (!site) {
            res.status(404).json({ error: "Site not found" });
            return;
        }
        // Current-month boundaries (used only for the recordsThisMonth stat)
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        // Build date filter from optional query params
        const { startDate, endDate } = req.query;
        const dateFilter = {};
        if (startDate)
            dateFilter.$gte = new Date(startDate);
        if (endDate)
            dateFilter.$lte = new Date(endDate);
        // Get site records (all records by default; filtered when query params are supplied)
        const recordQuery = { site_id: siteId, company_id };
        if (Object.keys(dateFilter).length > 0)
            recordQuery.date = dateFilter;
        const records = await models_1.SiteRecord.find(recordQuery)
            .sort({ createdAt: -1 })
            .populate("recordedBy", "name");
        // Count records for the current calendar month (stat card)
        const recordsThisMonth = await models_1.SiteRecord.countDocuments({
            site_id: siteId,
            company_id,
            date: { $gte: startOfMonth, $lte: endOfMonth },
        });
        // Get pending price count from main stock
        const pendingPriceCount = await models_1.MainStockRecord.countDocuments({
            site_id: siteId,
            company_id,
            status: "pending_price",
        });
        // Get last activity date
        const lastRecord = await models_1.SiteRecord.findOne({
            site_id: siteId,
            company_id,
        }).sort({ date: -1 });
        // Batch-fetch linked MainStockRecord price/status data
        const mainStockEntryIds = records
            .filter((r) => r.mainStockEntryId != null)
            .map((r) => r.mainStockEntryId);
        const mainStockEntries = await models_1.MainStockRecord.find({
            _id: { $in: mainStockEntryIds },
        }).select("_id price totalValue status");
        const mainStockMap = new Map(mainStockEntries.map((e) => [e._id.toString(), e]));
        res.json({
            site: {
                id: site._id.toString(),
                name: site.name,
                location: site.location,
                description: site.description,
                isActive: site.isActive,
            },
            records: records.map((r) => {
                const mainEntry = r.mainStockEntryId
                    ? mainStockMap.get(r.mainStockEntryId.toString())
                    : null;
                return {
                    _id: r._id.toString(),
                    materialName: r.materialName,
                    quantityReceived: r.quantityReceived,
                    quantityUsed: r.quantityUsed,
                    date: r.date,
                    notes: r.notes,
                    syncedToMainStock: r.syncedToMainStock,
                    mainStockEntryId: r.mainStockEntryId?.toString(),
                    recordedBy: r.recordedBy?._id?.toString() ||
                        r.recordedBy?.toString(),
                    recordedByName: r.recordedBy?.name,
                    createdAt: r.createdAt,
                    updatedAt: r.updatedAt,
                    price: mainEntry?.price ?? null,
                    totalValue: mainEntry?.totalValue ?? null,
                    status: mainEntry?.status ?? null,
                };
            }),
            stats: {
                recordsThisMonth,
                pendingPriceCount,
                lastActivityDate: lastRecord?.date?.toISOString() || null,
            },
        });
    }
    catch (error) {
        console.error("Get site details error:", error);
        res.status(500).json({ error: "Failed to fetch site details" });
    }
});
// Toggle site active status
router.patch("/:id/active", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const company_id = req.user.company_id;
        const site = await models_1.Site.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(id), company_id }, { $set: { isActive } }, { returnDocument: "after" });
        if (!site) {
            res.status(404).json({ error: "Site not found" });
            return;
        }
        // Log site status change (update)
        await actionLogService_1.ActionLogService.logSiteUpdate(req, site._id.toString(), site.name);
        res.json({
            id: site._id.toString(),
            name: site.name,
            isActive: site.isActive,
        });
    }
    catch (error) {
        console.error("Toggle site active error:", error);
        res.status(500).json({ error: "Failed to update site status" });
    }
});
// Delete site (main manager only)
router.delete("/:id", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const siteId = new mongoose_1.default.Types.ObjectId(id);
        // Find site first to get name for logging
        const site = await models_1.Site.findOne({ _id: siteId, company_id });
        if (!site) {
            res.status(404).json({ error: "Site not found" });
            return;
        }
        // Delete site and related data
        await models_1.Site.deleteOne({ _id: siteId, company_id });
        // Remove site from all users' assignedSites
        await models_1.User.updateMany({ assignedSites: siteId }, { $pull: { assignedSites: siteId } });
        // Delete site records and their synced main stock entries
        const siteRecords = await models_1.SiteRecord.find({
            site_id: siteId,
            company_id,
        });
        for (const record of siteRecords) {
            if (record.mainStockEntryId) {
                await models_1.MainStockRecord.findByIdAndDelete(record.mainStockEntryId);
            }
        }
        await models_1.SiteRecord.deleteMany({ site_id: siteId, company_id });
        // Log site deletion
        await actionLogService_1.ActionLogService.logSiteDelete(req, site._id.toString(), site.name);
        res.json({ message: "Site deleted successfully" });
    }
    catch (error) {
        console.error("Delete site error:", error);
        res.status(500).json({ error: "Failed to delete site" });
    }
});
// Assign site manager to site
router.post("/:id/assign", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
        const company_id = req.user.company_id;
        if (!userId) {
            res.status(400).json({ error: "User ID is required" });
            return;
        }
        const siteId = new mongoose_1.default.Types.ObjectId(id);
        const userObjId = new mongoose_1.default.Types.ObjectId(userId);
        // Verify site exists and belongs to company
        const site = await models_1.Site.findOne({ _id: siteId, company_id });
        if (!site) {
            res.status(404).json({ error: "Site not found" });
            return;
        }
        // Verify user exists, is a site manager, and belongs to company
        const user = await models_1.User.findOne({
            _id: userObjId,
            company_id,
            role: types_1.UserRole.SITE_MANAGER,
        });
        if (!user) {
            res
                .status(400)
                .json({ error: "User must be a site manager in your company" });
            return;
        }
        // Add site to user's assignedSites (if not already present)
        await models_1.User.findByIdAndUpdate(userId, {
            $addToSet: { assignedSites: siteId },
        });
        // Log site manager assignment
        await actionLogService_1.ActionLogService.logManagerAssign(req, site._id.toString(), site.name, user._id.toString(), user.name);
        res.status(201).json({ message: "Site manager assigned successfully" });
    }
    catch (error) {
        console.error("Assign site manager error:", error);
        res.status(500).json({ error: "Failed to assign site manager" });
    }
});
// Remove site manager from site
router.delete("/:id/assign/:userId", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id, userId } = req.params;
        const company_id = req.user.company_id;
        const siteId = new mongoose_1.default.Types.ObjectId(id);
        // Verify site belongs to company
        const site = await models_1.Site.findOne({ _id: siteId, company_id });
        if (!site) {
            res.status(404).json({ error: "Site not found" });
            return;
        }
        // Find user to get name for logging
        const user = await models_1.User.findOne({
            _id: userId,
            company_id,
            role: types_1.UserRole.SITE_MANAGER,
        });
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        // Remove site from user's assignedSites
        await models_1.User.findByIdAndUpdate(userId, {
            $pull: { assignedSites: siteId },
        });
        // Log site manager unassignment
        await actionLogService_1.ActionLogService.logManagerUnassign(req, site._id.toString(), site.name, userId, user.name);
        res.json({ message: "Site manager removed successfully" });
    }
    catch (error) {
        console.error("Remove site manager error:", error);
        res.status(500).json({ error: "Failed to remove site manager" });
    }
});
// Get site managers assigned to a site
router.get("/:id/managers", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const siteId = new mongoose_1.default.Types.ObjectId(id);
        // Verify site belongs to company
        const site = await models_1.Site.findOne({ _id: siteId, company_id });
        if (!site) {
            res.status(404).json({ error: "Site not found" });
            return;
        }
        // Find all site managers assigned to this site
        const managers = await models_1.User.find({
            company_id,
            role: types_1.UserRole.SITE_MANAGER,
            assignedSites: siteId,
        }).select("-password");
        res.json(managers.map((user) => ({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
        })));
    }
    catch (error) {
        console.error("Get site managers error:", error);
        res.status(500).json({ error: "Failed to fetch site managers" });
    }
});
// Get all site managers in company (for assignment dropdown)
router.get("/managers/available", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const managers = await models_1.User.find({
            company_id,
            role: types_1.UserRole.SITE_MANAGER,
            isActive: true,
        }).select("-password");
        res.json(managers.map((user) => ({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
        })));
    }
    catch (error) {
        console.error("Get available managers error:", error);
        res.status(500).json({ error: "Failed to fetch site managers" });
    }
});
exports.default = router;
//# sourceMappingURL=sites.js.map