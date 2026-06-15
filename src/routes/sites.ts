import { Router } from "express";
import { authenticateToken, requireMainStockManager } from "../middleware/auth";
import { UserRole } from "../types";
import { Site, User, SiteRecord, MainStockRecord } from "../models";
import { ActionLogService } from "../services/actionLogService";
import { NotificationService } from "../services/notificationService";
import mongoose from "mongoose";

const router = Router();

// Get all sites (main manager sees all company sites, site manager sees assigned)
router.get("/", authenticateToken, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;

    let sites;
    const managementRoles = [
      UserRole.MAIN_MANAGER,
      UserRole.ACCOUNTANT,
      UserRole.MANAGER,
    ];
    if (managementRoles.includes(req.user!.role)) {
      sites = await Site.find({ company_id });
    } else {
      // Site manager only sees their assigned sites
      const assignedIds =
        req.assignedSiteIds?.map((id) => new mongoose.Types.ObjectId(id)) || [];
      sites = await Site.find({
        company_id,
        _id: { $in: assignedIds },
      });
    }

    res.json(
      sites.map((site) => ({
        _id: site._id.toString(),
        name: site.name,
        location: site.location,
        description: site.description,
        company_id: site.company_id,
        isActive: site.isActive,
        createdBy: site.createdBy.toString(),
        createdAt: site.createdAt,
      })),
    );
  } catch (error) {
    console.error("Get sites error:", error);
    res.status(500).json({ error: "Failed to fetch sites" });
  }
});

// Get single site
router.get("/:id", authenticateToken, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const company_id = req.user!.company_id;

    // Check access for site managers
    if (req.user!.role === UserRole.SITE_MANAGER) {
      const hasAccess = req.assignedSiteIds?.includes(id as string);
      if (!hasAccess) {
        res.status(403).json({ error: "Access denied to this site" });
        return;
      }
    }

    const site = await Site.findOne({
      _id: new mongoose.Types.ObjectId(id as string),
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
  } catch (error) {
    console.error("Get site error:", error);
    res.status(500).json({ error: "Failed to fetch site" });
  }
});

// Create site (main manager only)
router.post(
  "/",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const { name, location, description } = req.body;
      const company_id = req.user!.company_id;

      if (!name) {
        res.status(400).json({ error: "Site name is required" });
        return;
      }

      const site = await Site.create({
        name,
        location,
        description,
        company_id,
        createdBy: new mongoose.Types.ObjectId(req.user!.id),
        isActive: true,
      });

      // Log site creation
      await ActionLogService.logSiteCreate(req, site._id.toString(), site.name);

      // Create notification for site creation
      await NotificationService.notifySiteCreated(
        req.user!.id,
        site.name,
        site.location || "Unknown location",
      );

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
    } catch (error) {
      console.error("Create site error:", error);
      res.status(500).json({ error: "Failed to create site" });
    }
  },
);

// Update site (main manager only)
router.put(
  "/:id",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, location, description, isActive } = req.body;
      const company_id = req.user!.company_id;

      const updateData: any = {};
      if (name) updateData.name = name;
      if (location !== undefined) updateData.location = location;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const site = await Site.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id as string), company_id },
        { $set: updateData },
        { returnDocument: "after" },
      );

      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      // Log site update
      await ActionLogService.logSiteUpdate(req, site._id.toString(), site.name);

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
    } catch (error) {
      console.error("Update site error:", error);
      res.status(500).json({ error: "Failed to update site" });
    }
  },
);

// Get site details with stats and records
router.get(
  "/:id/details",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const company_id = req.user!.company_id;
      const siteId = new mongoose.Types.ObjectId(id as string);

      const site = await Site.findOne({ _id: siteId, company_id });
      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      // Current-month boundaries (used only for the recordsThisMonth stat)
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      // Build date filter from optional query params
      const { startDate, endDate } = req.query as {
        startDate?: string;
        endDate?: string;
      };
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      // Get site records (all records by default; filtered when query params are supplied)
      const recordQuery: Record<string, any> = { site_id: siteId, company_id };
      if (Object.keys(dateFilter).length > 0) recordQuery.date = dateFilter;

      const records = await SiteRecord.find(recordQuery)
        .sort({ createdAt: -1 })
        .populate("recordedBy", "name");

      // Count records for the current calendar month (stat card)
      const recordsThisMonth = await SiteRecord.countDocuments({
        site_id: siteId,
        company_id,
        date: { $gte: startOfMonth, $lte: endOfMonth },
      });

      // Get pending price count from main stock
      const pendingPriceCount = await MainStockRecord.countDocuments({
        site_id: siteId,
        company_id,
        status: "pending_price",
      });

      // Get last activity date
      const lastRecord = await SiteRecord.findOne({
        site_id: siteId,
        company_id,
      }).sort({ date: -1 });

      // Batch-fetch linked MainStockRecord price/status data
      const mainStockEntryIds = records
        .filter((r) => r.mainStockEntryId != null)
        .map((r) => r.mainStockEntryId as mongoose.Types.ObjectId);

      const mainStockEntries = await MainStockRecord.find({
        _id: { $in: mainStockEntryIds },
      }).select("_id price totalValue status");

      const mainStockMap = new Map(
        mainStockEntries.map((e) => [e._id.toString(), e]),
      );

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
            recordedBy:
              (r.recordedBy as any)?._id?.toString() ||
              r.recordedBy?.toString(),
            recordedByName: (r.recordedBy as any)?.name,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            price: mainEntry?.price ?? null,
            totalValue: mainEntry?.totalValue ?? null,
            status: (mainEntry?.status as string) ?? null,
          };
        }),
        stats: {
          recordsThisMonth,
          pendingPriceCount,
          lastActivityDate: lastRecord?.date?.toISOString() || null,
        },
      });
    } catch (error) {
      console.error("Get site details error:", error);
      res.status(500).json({ error: "Failed to fetch site details" });
    }
  },
);

// Toggle site active status
router.patch(
  "/:id/active",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const company_id = req.user!.company_id;

      const site = await Site.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(id as string), company_id },
        { $set: { isActive } },
        { returnDocument: "after" },
      );

      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      // Log site status change (update)
      await ActionLogService.logSiteUpdate(req, site._id.toString(), site.name);

      res.json({
        id: site._id.toString(),
        name: site.name,
        isActive: site.isActive,
      });
    } catch (error) {
      console.error("Toggle site active error:", error);
      res.status(500).json({ error: "Failed to update site status" });
    }
  },
);

// Delete site (main manager only)
router.delete(
  "/:id",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const company_id = req.user!.company_id;
      const siteId = new mongoose.Types.ObjectId(id as string);

      // Find site first to get name for logging
      const site = await Site.findOne({ _id: siteId, company_id });
      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      // Delete site and related data
      await Site.deleteOne({ _id: siteId, company_id });

      // Remove site from all users' assignedSites
      await User.updateMany(
        { assignedSites: siteId },
        { $pull: { assignedSites: siteId } },
      );

      // Delete site records and their synced main stock entries
      const siteRecords = await SiteRecord.find({
        site_id: siteId,
        company_id,
      });
      for (const record of siteRecords) {
        if (record.mainStockEntryId) {
          await MainStockRecord.findByIdAndDelete(record.mainStockEntryId);
        }
      }
      await SiteRecord.deleteMany({ site_id: siteId, company_id });

      // Log site deletion
      await ActionLogService.logSiteDelete(req, site._id.toString(), site.name);

      res.json({ message: "Site deleted successfully" });
    } catch (error) {
      console.error("Delete site error:", error);
      res.status(500).json({ error: "Failed to delete site" });
    }
  },
);

// Assign site manager to site
router.post(
  "/:id/assign",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const company_id = req.user!.company_id;

      if (!userId) {
        res.status(400).json({ error: "User ID is required" });
        return;
      }

      const siteId = new mongoose.Types.ObjectId(id as string);
      const userObjId = new mongoose.Types.ObjectId(userId);

      // Verify site exists and belongs to company
      const site = await Site.findOne({ _id: siteId, company_id });
      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      // Verify user exists, is a site manager, and belongs to company
      const user = await User.findOne({
        _id: userObjId,
        company_id,
        role: UserRole.SITE_MANAGER,
      });
      if (!user) {
        res
          .status(400)
          .json({ error: "User must be a site manager in your company" });
        return;
      }

      // Add site to user's assignedSites (if not already present)
      await User.findByIdAndUpdate(userId, {
        $addToSet: { assignedSites: siteId },
      });

      // Log site manager assignment
      await ActionLogService.logManagerAssign(
        req,
        site._id.toString(),
        site.name,
        user._id.toString(),
        user.name,
      );

      res.status(201).json({ message: "Site manager assigned successfully" });
    } catch (error) {
      console.error("Assign site manager error:", error);
      res.status(500).json({ error: "Failed to assign site manager" });
    }
  },
);

// Remove site manager from site
router.delete(
  "/:id/assign/:userId",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const { id, userId } = req.params;
      const company_id = req.user!.company_id;

      const siteId = new mongoose.Types.ObjectId(id as string);

      // Verify site belongs to company
      const site = await Site.findOne({ _id: siteId, company_id });
      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      // Find user to get name for logging
      const user = await User.findOne({
        _id: userId,
        company_id,
        role: UserRole.SITE_MANAGER,
      });
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Remove site from user's assignedSites
      await User.findByIdAndUpdate(userId, {
        $pull: { assignedSites: siteId },
      });

      // Log site manager unassignment
      await ActionLogService.logManagerUnassign(
        req,
        site._id.toString(),
        site.name,
        userId as string,
        user.name,
      );

      res.json({ message: "Site manager removed successfully" });
    } catch (error) {
      console.error("Remove site manager error:", error);
      res.status(500).json({ error: "Failed to remove site manager" });
    }
  },
);

// Get site managers assigned to a site
router.get(
  "/:id/managers",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const { id } = req.params;
      const company_id = req.user!.company_id;

      const siteId = new mongoose.Types.ObjectId(id as string);

      // Verify site belongs to company
      const site = await Site.findOne({ _id: siteId, company_id });
      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      // Find all site managers assigned to this site
      const managers = await User.find({
        company_id,
        role: UserRole.SITE_MANAGER,
        assignedSites: siteId,
      }).select("-password");

      res.json(
        managers.map((user) => ({
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        })),
      );
    } catch (error) {
      console.error("Get site managers error:", error);
      res.status(500).json({ error: "Failed to fetch site managers" });
    }
  },
);

// Get all site managers in company (for assignment dropdown)
router.get(
  "/managers/available",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const company_id = req.user!.company_id;

      const managers = await User.find({
        company_id,
        role: UserRole.SITE_MANAGER,
        isActive: true,
      }).select("-password");

      res.json(
        managers.map((user) => ({
          id: user._id.toString(),
          name: user.name,
          email: user.email,
        })),
      );
    } catch (error) {
      console.error("Get available managers error:", error);
      res.status(500).json({ error: "Failed to fetch site managers" });
    }
  },
);

export default router;
