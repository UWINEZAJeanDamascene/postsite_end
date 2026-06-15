import { Router } from "express";
import { Quotation, PurchaseOrder, Site } from "../models";
import { IQuotation } from "../models/Quotation";
import { authenticateToken, requireMainStockManager } from "../middleware/auth";
import { ActionLogService } from "../services/actionLogService";
import { ActionType, ResourceType } from "../models/ActionLog";
import mongoose from "mongoose";
import { UserRole } from "../types";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateQTNumber(company_id: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QT-${year}-`;
  const last = await Quotation.findOne(
    { company_id, qtNumber: { $regex: `^${prefix}` } },
    { qtNumber: 1 },
  ).sort({ qtNumber: -1 });
  let seq = 1;
  if (last) {
    const n = parseInt(last.qtNumber.split("-")[2], 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

async function generatePONumber(company_id: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const last = await PurchaseOrder.findOne(
    { company_id, poNumber: { $regex: `^${prefix}` } },
    { poNumber: 1 },
  ).sort({ poNumber: -1 });
  let seq = 1;
  if (last) {
    const n = parseInt(last.poNumber.split("-")[2], 10);
    if (!isNaN(n)) seq = n + 1;
  }
  return `${prefix}${seq.toString().padStart(4, "0")}`;
}

function calculateTotals(items: any[], taxRate = 0) {
  const subTotal = items.reduce((s: number, i: any) => s + i.totalPrice, 0);
  const taxAmount = subTotal * (taxRate / 100);
  return { subTotal, taxRate, taxAmount, totalAmount: subTotal + taxAmount };
}

function formatQt(qt: IQuotation) {
  return {
    id: (qt as any)._id.toString(),
    qtNumber: qt.qtNumber,
    supplier: qt.supplier,
    site: qt.site_id,
    status: qt.status,
    items: qt.items,
    subTotal: qt.subTotal,
    taxRate: qt.taxRate,
    taxAmount: qt.taxAmount,
    totalAmount: qt.totalAmount,
    validUntil: qt.validUntil,
    notes: qt.notes,
    terms: qt.terms,
    sentDate: qt.sentDate,
    convertedToPO: qt.convertedToPO,
    createdBy: (qt.createdBy as any)?.name || qt.createdBy,
    createdAt: qt.createdAt,
    updatedAt: qt.updatedAt,
  };
}

// ── GET / — List ──────────────────────────────────────────────────────────────

router.get("/", authenticateToken, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const {
      status,
      siteId,
      supplier,
      startDate,
      endDate,
      page = "1",
      limit = "20",
    } = req.query;

    const where: any = { company_id };

    if (req.user!.role === UserRole.SITE_MANAGER) {
      if (!req.assignedSiteIds?.length) {
        res.json({ records: [], total: 0, page: 1, totalPages: 0 });
        return;
      }
      where.site_id = {
        $in: req.assignedSiteIds
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    if (status && status !== "all") where.status = status;
    if (siteId && mongoose.Types.ObjectId.isValid(siteId as string))
      where.site_id = new mongoose.Types.ObjectId(siteId as string);
    if (supplier) where["supplier.name"] = { $regex: supplier, $options: "i" };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.$gte = new Date(startDate as string);
      if (endDate) where.createdAt.$lte = new Date(endDate as string);
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;

    const [records, total] = await Promise.all([
      Quotation.find(where)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate("site_id", "name location")
        .populate("createdBy", "name"),
      Quotation.countDocuments(where),
    ]);

    res.json({
      records: records.map((qt) => formatQt(qt as IQuotation)),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error("Get quotations error:", err);
    res.status(500).json({ error: "Failed to fetch quotations" });
  }
});

// ── GET /:id — Single ─────────────────────────────────────────────────────────

router.get("/:id", authenticateToken, async (req, res): Promise<void> => {
  try {
    const id = String(req.params.id);
    const qt = await Quotation.findOne({
      _id: new mongoose.Types.ObjectId(id),
      company_id: req.user!.company_id,
    })
      .populate("site_id", "name location")
      .populate("createdBy", "name");

    if (!qt) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }
    res.json(formatQt(qt as IQuotation));
  } catch (err) {
    console.error("Get quotation error:", err);
    res.status(500).json({ error: "Failed to fetch quotation" });
  }
});

// ── POST / — Create ───────────────────────────────────────────────────────────

router.post(
  "/",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const company_id = req.user!.company_id;
      const {
        supplier,
        site_id,
        items,
        taxRate = 0,
        validUntil,
        notes,
        terms,
      } = req.body;

      if (!supplier?.name || !items?.length) {
        res.status(400).json({ error: "Supplier name and items are required" });
        return;
      }

      if (site_id) {
        if (!mongoose.Types.ObjectId.isValid(site_id)) {
          res.status(400).json({ error: "Invalid site ID" });
          return;
        }
        const site = await Site.findOne({
          _id: new mongoose.Types.ObjectId(site_id),
          company_id,
        });
        if (!site) {
          res.status(404).json({ error: "Site not found" });
          return;
        }
      }

      const processedItems = items.map((i: any) => ({
        materialName: i.materialName,
        material_id: i.material_id || null,
        description: i.description || "",
        quantityRequested: i.quantityRequested || 0,
        unitPrice: i.unitPrice || 0,
        totalPrice: (i.quantityRequested || 0) * (i.unitPrice || 0),
        unit: i.unit || "pcs",
        notes: i.notes || "",
      }));

      const totals = calculateTotals(processedItems, taxRate);
      const qtNumber = await generateQTNumber(company_id);

      const qt = (await Quotation.create({
        qtNumber,
        supplier,
        site_id: site_id ? new mongoose.Types.ObjectId(site_id) : undefined,
        status: "draft",
        items: processedItems,
        ...totals,
        validUntil: validUntil ? new Date(validUntil) : undefined,
        notes,
        terms,
        createdBy: new mongoose.Types.ObjectId(req.user!.id),
        company_id,
      })) as any;

      await ActionLogService.logFromRequest(
        req,
        ActionType.CREATE,
        ResourceType.QUOTATION,
        `Created quotation ${qtNumber} for ${supplier.name}`,
        { resourceId: qt._id.toString(), resourceName: qtNumber },
      );

      res.status(201).json({
        id: qt._id.toString(),
        qtNumber: qt.qtNumber,
        supplier: qt.supplier,
        status: qt.status,
        totalAmount: qt.totalAmount,
        message: "Quotation created successfully",
      });
    } catch (err) {
      console.error("Create quotation error:", err);
      res.status(500).json({ error: "Failed to create quotation" });
    }
  },
);

// ── PUT /:id — Update (draft only) ────────────────────────────────────────────

router.put(
  "/:id",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params.id);
      const company_id = req.user!.company_id;
      const {
        supplier,
        site_id,
        items,
        taxRate = 0,
        validUntil,
        notes,
        terms,
      } = req.body;

      const qt = await Quotation.findOne({
        _id: new mongoose.Types.ObjectId(id),
        company_id,
      });
      if (!qt) {
        res.status(404).json({ error: "Quotation not found" });
        return;
      }
      if (qt.status !== "draft") {
        res.status(400).json({ error: "Only draft quotations can be edited" });
        return;
      }

      if (site_id) {
        if (!mongoose.Types.ObjectId.isValid(site_id)) {
          res.status(400).json({ error: "Invalid site ID" });
          return;
        }
        const site = await Site.findOne({
          _id: new mongoose.Types.ObjectId(site_id),
          company_id,
        });
        if (!site) {
          res.status(404).json({ error: "Site not found" });
          return;
        }
      }

      const processedItems = items.map((i: any) => ({
        materialName: i.materialName,
        material_id: i.material_id || null,
        description: i.description || "",
        quantityRequested: i.quantityRequested || 0,
        unitPrice: i.unitPrice || 0,
        totalPrice: (i.quantityRequested || 0) * (i.unitPrice || 0),
        unit: i.unit || "pcs",
        notes: i.notes || "",
      }));

      const totals = calculateTotals(processedItems, taxRate);

      qt.supplier = supplier;
      qt.site_id = site_id ? new mongoose.Types.ObjectId(site_id) : undefined;
      qt.items = processedItems as any;
      qt.subTotal = totals.subTotal;
      qt.taxRate = totals.taxRate;
      qt.taxAmount = totals.taxAmount;
      qt.totalAmount = totals.totalAmount;
      qt.validUntil = validUntil ? new Date(validUntil) : undefined;
      qt.notes = notes;
      qt.terms = terms;
      await qt.save();

      await ActionLogService.logFromRequest(
        req,
        ActionType.UPDATE,
        ResourceType.QUOTATION,
        `Updated quotation ${qt.qtNumber}`,
        {
          resourceId: (qt as any)._id.toString(),
          resourceName: qt.qtNumber,
        },
      );

      res.json({
        id: (qt as any)._id.toString(),
        qtNumber: qt.qtNumber,
        message: "Quotation updated successfully",
      });
    } catch (err) {
      console.error("Update quotation error:", err);
      res.status(500).json({ error: "Failed to update quotation" });
    }
  },
);

// ── DELETE /:id ───────────────────────────────────────────────────────────────

router.delete(
  "/:id",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params.id);
      const qt = await Quotation.findOne({
        _id: new mongoose.Types.ObjectId(id),
        company_id: req.user!.company_id,
      });
      if (!qt) {
        res.status(404).json({ error: "Quotation not found" });
        return;
      }
      if (qt.status !== "draft") {
        res.status(400).json({ error: "Only draft quotations can be deleted" });
        return;
      }
      await Quotation.deleteOne({ _id: (qt as any)._id });

      await ActionLogService.logFromRequest(
        req,
        ActionType.DELETE,
        ResourceType.QUOTATION,
        `Deleted quotation ${qt.qtNumber}`,
        {
          resourceId: (qt as any)._id.toString(),
          resourceName: qt.qtNumber,
        },
      );
      res.json({ message: "Quotation deleted successfully" });
    } catch (err) {
      console.error("Delete quotation error:", err);
      res.status(500).json({ error: "Failed to delete quotation" });
    }
  },
);

// ── POST /:id/duplicate ───────────────────────────────────────────────────────

router.post(
  "/:id/duplicate",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params.id);
      const company_id = req.user!.company_id;
      const original = await Quotation.findOne({
        _id: new mongoose.Types.ObjectId(id),
        company_id,
      });
      if (!original) {
        res.status(404).json({ error: "Quotation not found" });
        return;
      }

      const qtNumber = await generateQTNumber(company_id);
      const copy = (await Quotation.create({
        qtNumber,
        supplier: original.supplier,
        site_id: original.site_id,
        status: "draft",
        items: original.items,
        subTotal: original.subTotal,
        taxRate: original.taxRate,
        taxAmount: original.taxAmount,
        totalAmount: original.totalAmount,
        validUntil: original.validUntil,
        notes: original.notes,
        terms: original.terms,
        createdBy: new mongoose.Types.ObjectId(req.user!.id),
        company_id,
      })) as any;

      await ActionLogService.logFromRequest(
        req,
        ActionType.CREATE,
        ResourceType.QUOTATION,
        `Duplicated quotation ${original.qtNumber} → ${qtNumber}`,
        { resourceId: copy._id.toString(), resourceName: qtNumber },
      );

      res.status(201).json({
        id: copy._id.toString(),
        qtNumber: copy.qtNumber,
        message: "Quotation duplicated",
      });
    } catch (err) {
      console.error("Duplicate quotation error:", err);
      res.status(500).json({ error: "Failed to duplicate quotation" });
    }
  },
);

// ── PATCH /:id/send ───────────────────────────────────────────────────────────

router.patch(
  "/:id/send",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params.id);
      const qt = await Quotation.findOne({
        _id: new mongoose.Types.ObjectId(id),
        company_id: req.user!.company_id,
      });
      if (!qt) {
        res.status(404).json({ error: "Quotation not found" });
        return;
      }
      if (qt.status !== "draft") {
        res.status(400).json({ error: "Only draft quotations can be sent" });
        return;
      }
      qt.status = "sent";
      qt.sentDate = new Date();
      await qt.save();

      await ActionLogService.logFromRequest(
        req,
        ActionType.UPDATE,
        ResourceType.QUOTATION,
        `Sent quotation ${qt.qtNumber} to ${qt.supplier.name}`,
        {
          resourceId: (qt as any)._id.toString(),
          resourceName: qt.qtNumber,
        },
      );

      res.json({
        id: (qt as any)._id.toString(),
        qtNumber: qt.qtNumber,
        status: qt.status,
        sentDate: qt.sentDate,
        message: "Quotation sent",
      });
    } catch (err) {
      console.error("Send quotation error:", err);
      res.status(500).json({ error: "Failed to send quotation" });
    }
  },
);

// ── PATCH /:id/accept ─────────────────────────────────────────────────────────

router.patch(
  "/:id/accept",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params.id);
      const qt = await Quotation.findOne({
        _id: new mongoose.Types.ObjectId(id),
        company_id: req.user!.company_id,
      });
      if (!qt) {
        res.status(404).json({ error: "Quotation not found" });
        return;
      }
      if (qt.status !== "sent") {
        res.status(400).json({ error: "Only sent quotations can be accepted" });
        return;
      }
      qt.status = "accepted";
      await qt.save();

      await ActionLogService.logFromRequest(
        req,
        ActionType.UPDATE,
        ResourceType.QUOTATION,
        `Accepted quotation ${qt.qtNumber}`,
        {
          resourceId: (qt as any)._id.toString(),
          resourceName: qt.qtNumber,
        },
      );

      res.json({
        id: (qt as any)._id.toString(),
        qtNumber: qt.qtNumber,
        status: qt.status,
        message: "Quotation accepted",
      });
    } catch (err) {
      console.error("Accept quotation error:", err);
      res.status(500).json({ error: "Failed to accept quotation" });
    }
  },
);

// ── PATCH /:id/reject ─────────────────────────────────────────────────────────

router.patch(
  "/:id/reject",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params.id);
      const qt = await Quotation.findOne({
        _id: new mongoose.Types.ObjectId(id),
        company_id: req.user!.company_id,
      });
      if (!qt) {
        res.status(404).json({ error: "Quotation not found" });
        return;
      }
      if (qt.status !== "sent") {
        res.status(400).json({ error: "Only sent quotations can be rejected" });
        return;
      }
      qt.status = "rejected";
      await qt.save();

      await ActionLogService.logFromRequest(
        req,
        ActionType.UPDATE,
        ResourceType.QUOTATION,
        `Rejected quotation ${qt.qtNumber}`,
        {
          resourceId: (qt as any)._id.toString(),
          resourceName: qt.qtNumber,
        },
      );

      res.json({
        id: (qt as any)._id.toString(),
        qtNumber: qt.qtNumber,
        status: qt.status,
        message: "Quotation rejected",
      });
    } catch (err) {
      console.error("Reject quotation error:", err);
      res.status(500).json({ error: "Failed to reject quotation" });
    }
  },
);

// ── POST /:id/convert — Convert accepted quotation to PO ──────────────────────

router.post(
  "/:id/convert",
  authenticateToken,
  requireMainStockManager,
  async (req, res): Promise<void> => {
    try {
      const id = String(req.params.id);
      const company_id = req.user!.company_id;

      const qt = await Quotation.findOne({
        _id: new mongoose.Types.ObjectId(id),
        company_id,
      });
      if (!qt) {
        res.status(404).json({ error: "Quotation not found" });
        return;
      }
      if (qt.status !== "accepted") {
        res.status(400).json({
          error:
            "Only accepted quotations can be converted to a purchase order",
        });
        return;
      }
      if (qt.convertedToPO) {
        res.status(400).json({
          error:
            "This quotation has already been converted to a purchase order",
        });
        return;
      }
      if (!qt.site_id) {
        res.status(400).json({
          error:
            "Quotation must have a site assigned before converting to purchase order. Please edit the quotation and add a site.",
        });
        return;
      }

      const site = await Site.findOne({ _id: qt.site_id, company_id });
      if (!site) {
        res.status(404).json({ error: "Site not found" });
        return;
      }

      const poNumber = await generatePONumber(company_id);

      const poItems = qt.items.map((item: any) => ({
        materialName: item.materialName,
        material_id: item.material_id || null,
        description: item.description || "",
        quantityOrdered: item.quantityRequested,
        quantityReceived: 0,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        unit: item.unit,
        notes: item.notes || "",
      }));

      const po = (await PurchaseOrder.create({
        poNumber,
        supplier: qt.supplier,
        site_id: qt.site_id,
        status: "draft",
        items: poItems,
        subTotal: qt.subTotal,
        taxRate: qt.taxRate,
        taxAmount: qt.taxAmount,
        totalAmount: qt.totalAmount,
        notes: qt.notes,
        terms: qt.terms,
        expectedDeliveryDate: qt.validUntil || undefined,
        createdBy: new mongoose.Types.ObjectId(req.user!.id),
        company_id,
      })) as any;

      qt.convertedToPO = po._id as mongoose.Types.ObjectId;
      await qt.save();

      await ActionLogService.logFromRequest(
        req,
        ActionType.CREATE,
        ResourceType.PURCHASE_ORDER,
        `Converted quotation ${qt.qtNumber} to purchase order ${poNumber}`,
        { resourceId: po._id.toString(), resourceName: poNumber },
      );

      res.status(201).json({
        id: (qt as any)._id.toString(),
        qtNumber: qt.qtNumber,
        convertedToPO: { id: po._id.toString(), poNumber },
        message: `Quotation converted to purchase order ${poNumber}`,
      });
    } catch (err) {
      console.error("Convert quotation error:", err);
      res
        .status(500)
        .json({ error: "Failed to convert quotation to purchase order" });
    }
  },
);

export default router;
