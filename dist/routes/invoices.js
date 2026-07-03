"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoiceNumber = void 0;
const express_1 = require("express");
const mongoose_1 = __importDefault(require("mongoose"));
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const actionLogService_1 = require("../services/actionLogService");
const ActionLog_1 = require("../models/ActionLog");
const types_1 = require("../types");
const router = (0, express_1.Router)();
async function generateInvoiceNumber(company_id) {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const last = await models_1.Invoice.findOne({ company_id, invoiceNumber: { $regex: `^${prefix}` } }, { invoiceNumber: 1 }).sort({ invoiceNumber: -1 });
    let seq = 1;
    if (last) {
        const n = parseInt(last.invoiceNumber.split("-")[2], 10);
        if (!isNaN(n))
            seq = n + 1;
    }
    return `${prefix}${seq.toString().padStart(4, "0")}`;
}
exports.generateInvoiceNumber = generateInvoiceNumber;
function calculateTotals(items, taxRate = 0) {
    const subTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxAmount = subTotal * (taxRate / 100);
    const totalAmount = subTotal + taxAmount;
    return { subTotal, taxRate, taxAmount, totalAmount };
}
function formatInvoice(invoice) {
    return {
        id: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        quotation_id: invoice.quotation_id?.toString(),
        qtNumber: invoice.qtNumber,
        client_id: invoice.client_id?.toString(),
        client: invoice.client,
        site: invoice.site_id,
        status: invoice.status,
        items: invoice.items,
        subTotal: invoice.subTotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        totalAmount: invoice.totalAmount,
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        notes: invoice.notes,
        terms: invoice.terms,
        sentDate: invoice.sentDate,
        paidDate: invoice.paidDate,
        createdBy: invoice.createdBy?.name || invoice.createdBy,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt,
    };
}
function formatMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}
function buildInvoiceHtml(invoice, company) {
    const client = invoice.client || {};
    const site = invoice.site_id;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1f2937; }
    .header { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 32px; }
    h1 { margin: 0; font-size: 32px; letter-spacing: 0.08em; }
    .muted { color: #6b7280; }
    .status { display: inline-block; padding: 6px 14px; border-radius: 999px; background: #eef2ff; font-weight: 700; text-transform: uppercase; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; }
    .label { font-size: 12px; text-transform: uppercase; font-weight: 700; color: #6b7280; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    th { text-align: left; background: #f3f4f6; text-transform: uppercase; font-size: 11px; }
    .right { text-align: right; }
    .totals { margin-top: 20px; margin-left: auto; width: 280px; }
    .total-row { display: flex; justify-content: space-between; padding: 7px 0; }
    .grand { border-top: 1px solid #d1d5db; font-size: 18px; font-weight: 700; }
    .no-print { margin-top: 28px; text-align: center; }
    @media print { .no-print { display: none; } body { margin: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>INVOICE</h1>
      <p class="muted">${invoice.invoiceNumber}</p>
      ${invoice.qtNumber ? `<p class="muted">From quotation ${invoice.qtNumber}</p>` : ""}
    </div>
    <div class="right">
      <div class="status">${invoice.status}</div>
      <p>Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}</p>
      ${invoice.dueDate ? `<p>Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}</p>` : ""}
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="label">Bill To</div>
      <strong>${client.name || "-"}</strong>
      ${client.contactPerson ? `<p>${client.contactPerson}</p>` : ""}
      ${client.email ? `<p>${client.email}</p>` : ""}
      ${client.phone ? `<p>${client.phone}</p>` : ""}
      ${client.address ? `<p>${client.address}</p>` : ""}
    </div>
    <div class="box">
      <div class="label">From</div>
      <strong>${company?.name || "Lilstock"}</strong>
      ${company?.email ? `<p>${company.email}</p>` : ""}
      ${company?.phone ? `<p>${company.phone}</p>` : ""}
      ${company?.address ? `<p>${company.address}</p>` : ""}
      ${site?.name ? `<p>Site: ${site.name}</p>` : ""}
    </div>
  </div>

  <table>
    <thead>
      <tr><th>#</th><th>Item</th><th>Description</th><th class="right">Qty</th><th>Unit</th><th class="right">Unit Price</th><th class="right">Total</th></tr>
    </thead>
    <tbody>
      ${invoice.items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${item.materialName}</strong></td>
          <td>${item.description || "-"}</td>
          <td class="right">${item.quantity}</td>
          <td>${item.unit}</td>
          <td class="right">${formatMoney(item.unitPrice)}</td>
          <td class="right">${formatMoney(item.totalPrice)}</td>
        </tr>`).join("")}
    </tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span>${formatMoney(invoice.subTotal)}</span></div>
    <div class="total-row"><span>Tax (${invoice.taxRate}%)</span><span>${formatMoney(invoice.taxAmount)}</span></div>
    <div class="total-row"><span>Paid</span><span>${formatMoney(invoice.amountPaid)}</span></div>
    <div class="total-row grand"><span>Balance Due</span><span>${formatMoney(invoice.balanceDue)}</span></div>
  </div>

  ${invoice.notes ? `<div class="box" style="margin-top: 28px;"><div class="label">Notes</div>${invoice.notes}</div>` : ""}
  ${invoice.terms ? `<div class="box" style="margin-top: 16px;"><div class="label">Terms</div>${invoice.terms}</div>` : ""}

  <div class="no-print"><button onclick="window.print()">Print / Save as PDF</button></div>
</body>
</html>`;
}
router.get("/", auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { status, client, clientId, siteId, startDate, endDate, page = "1", limit = "20" } = req.query;
        const where = { company_id };
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds?.length) {
                res.json({ records: [], total: 0, page: 1, totalPages: 0 });
                return;
            }
            where.site_id = {
                $in: req.assignedSiteIds
                    .filter((id) => mongoose_1.default.Types.ObjectId.isValid(id))
                    .map((id) => new mongoose_1.default.Types.ObjectId(id)),
            };
        }
        if (status && status !== "all")
            where.status = status;
        if (client)
            where["client.name"] = { $regex: client, $options: "i" };
        if (clientId && mongoose_1.default.Types.ObjectId.isValid(clientId))
            where.client_id = new mongoose_1.default.Types.ObjectId(clientId);
        if (siteId && mongoose_1.default.Types.ObjectId.isValid(siteId))
            where.site_id = new mongoose_1.default.Types.ObjectId(siteId);
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.$gte = new Date(startDate);
            if (endDate)
                where.createdAt.$lte = new Date(endDate);
        }
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const [records, total] = await Promise.all([
            models_1.Invoice.find(where)
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate("site_id", "name location")
                .populate("createdBy", "name"),
            models_1.Invoice.countDocuments(where),
        ]);
        res.json({
            records: records.map((invoice) => formatInvoice(invoice)),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (err) {
        console.error("Get invoices error:", err);
        res.status(500).json({ error: "Failed to fetch invoices" });
    }
});
router.get("/stats/overview", auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const byStatusRows = await models_1.Invoice.aggregate([
            { $match: { company_id } },
            { $group: { _id: "$status", count: { $sum: 1 }, value: { $sum: "$totalAmount" }, balanceDue: { $sum: "$balanceDue" } } },
        ]);
        const byStatus = {};
        byStatusRows.forEach((row) => {
            byStatus[row._id] = { count: row.count, value: row.value, balanceDue: row.balanceDue };
        });
        const totals = await models_1.Invoice.aggregate([
            { $match: { company_id } },
            { $group: { _id: null, total: { $sum: 1 }, totalValue: { $sum: "$totalAmount" }, outstandingValue: { $sum: "$balanceDue" } } },
        ]);
        res.json({
            total: totals[0]?.total || 0,
            byStatus,
            totalValue: totals[0]?.totalValue || 0,
            outstandingValue: totals[0]?.outstandingValue || 0,
        });
    }
    catch (err) {
        console.error("Get invoice stats error:", err);
        res.status(500).json({ error: "Failed to fetch invoice stats" });
    }
});
router.get("/:id", auth_1.authenticateToken, async (req, res) => {
    try {
        const id = String(req.params.id);
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ error: "Invalid invoice ID" });
            return;
        }
        const invoice = await models_1.Invoice.findOne({
            _id: new mongoose_1.default.Types.ObjectId(id),
            company_id: req.user.company_id,
        })
            .populate("site_id", "name location")
            .populate("createdBy", "name");
        if (!invoice) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        res.json(formatInvoice(invoice));
    }
    catch (err) {
        console.error("Get invoice error:", err);
        res.status(500).json({ error: "Failed to fetch invoice" });
    }
});
router.post("/", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { client_id, site_id, items, taxRate = 0, dueDate, notes, terms } = req.body;
        if (!client_id || !items?.length) {
            res.status(400).json({ error: "Client and items are required" });
            return;
        }
        const client = await models_1.Client.findOne({ _id: new mongoose_1.default.Types.ObjectId(client_id), company_id }).lean();
        if (!client) {
            res.status(404).json({ error: "Client not found" });
            return;
        }
        if (site_id) {
            const site = await models_1.Site.findOne({ _id: new mongoose_1.default.Types.ObjectId(site_id), company_id });
            if (!site) {
                res.status(404).json({ error: "Site not found" });
                return;
            }
        }
        const processedItems = items.map((item) => ({
            materialName: item.materialName,
            material_id: item.material_id || null,
            description: item.description || "",
            quantity: item.quantity || 0,
            unitPrice: item.unitPrice || 0,
            totalPrice: (item.quantity || 0) * (item.unitPrice || 0),
            unit: item.unit || "pcs",
            notes: item.notes || "",
        }));
        const totals = calculateTotals(processedItems, taxRate);
        const invoiceNumber = await generateInvoiceNumber(company_id);
        const invoice = (await models_1.Invoice.create({
            invoiceNumber,
            client_id: new mongoose_1.default.Types.ObjectId(client_id),
            client: {
                name: client.name,
                contactPerson: client.contactPerson || "",
                email: client.email || "",
                phone: client.phone || "",
                address: client.address || "",
                taxId: client.taxId || "",
            },
            site_id: site_id ? new mongoose_1.default.Types.ObjectId(site_id) : undefined,
            status: "draft",
            items: processedItems,
            ...totals,
            amountPaid: 0,
            balanceDue: totals.totalAmount,
            issueDate: new Date(),
            dueDate: dueDate ? new Date(dueDate) : undefined,
            notes,
            terms,
            createdBy: new mongoose_1.default.Types.ObjectId(req.user.id),
            company_id,
        }));
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.INVOICE, `Created invoice ${invoiceNumber} for ${client.name}`, { resourceId: invoice._id.toString(), resourceName: invoiceNumber });
        res.status(201).json({ ...formatInvoice(invoice), message: "Invoice created successfully" });
    }
    catch (err) {
        console.error("Create invoice error:", err);
        res.status(500).json({ error: "Failed to create invoice" });
    }
});
router.patch("/:id/send", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const invoice = await models_1.Invoice.findOne({ _id: new mongoose_1.default.Types.ObjectId(String(req.params.id)), company_id: req.user.company_id });
        if (!invoice) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        if (invoice.status !== "draft") {
            res.status(400).json({ error: "Only draft invoices can be sent" });
            return;
        }
        invoice.status = "sent";
        invoice.sentDate = new Date();
        await invoice.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.INVOICE, `Sent invoice ${invoice.invoiceNumber}`, {
            resourceId: invoice._id.toString(),
            resourceName: invoice.invoiceNumber,
        });
        res.json({ ...formatInvoice(invoice), message: "Invoice sent" });
    }
    catch (err) {
        console.error("Send invoice error:", err);
        res.status(500).json({ error: "Failed to send invoice" });
    }
});
router.patch("/:id/pay", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const invoice = await models_1.Invoice.findOne({ _id: new mongoose_1.default.Types.ObjectId(String(req.params.id)), company_id: req.user.company_id });
        if (!invoice) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        if (["paid", "cancelled"].includes(invoice.status)) {
            res.status(400).json({ error: "This invoice cannot be marked as paid" });
            return;
        }
        const amountPaid = req.body?.amountPaid === undefined ? invoice.totalAmount : Number(req.body.amountPaid);
        if (Number.isNaN(amountPaid) || amountPaid < 0 || amountPaid > invoice.totalAmount) {
            res.status(400).json({ error: "Invalid paid amount" });
            return;
        }
        invoice.amountPaid = amountPaid;
        invoice.balanceDue = Math.max(invoice.totalAmount - amountPaid, 0);
        if (invoice.balanceDue === 0) {
            invoice.status = "paid";
            invoice.paidDate = new Date();
        }
        await invoice.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.INVOICE, `Recorded payment for invoice ${invoice.invoiceNumber}`, {
            resourceId: invoice._id.toString(),
            resourceName: invoice.invoiceNumber,
        });
        res.json({ ...formatInvoice(invoice), message: "Invoice payment recorded" });
    }
    catch (err) {
        console.error("Pay invoice error:", err);
        res.status(500).json({ error: "Failed to record invoice payment" });
    }
});
router.patch("/:id/cancel", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const invoice = await models_1.Invoice.findOne({ _id: new mongoose_1.default.Types.ObjectId(String(req.params.id)), company_id: req.user.company_id });
        if (!invoice) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        if (invoice.status === "paid") {
            res.status(400).json({ error: "Paid invoices cannot be cancelled" });
            return;
        }
        invoice.status = "cancelled";
        await invoice.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.INVOICE, `Cancelled invoice ${invoice.invoiceNumber}`, {
            resourceId: invoice._id.toString(),
            resourceName: invoice.invoiceNumber,
        });
        res.json({ ...formatInvoice(invoice), message: "Invoice cancelled" });
    }
    catch (err) {
        console.error("Cancel invoice error:", err);
        res.status(500).json({ error: "Failed to cancel invoice" });
    }
});
router.get("/:id/pdf", auth_1.authenticateToken, async (req, res) => {
    try {
        const invoice = await models_1.Invoice.findOne({
            _id: new mongoose_1.default.Types.ObjectId(String(req.params.id)),
            company_id: req.user.company_id,
        }).populate("site_id", "name location");
        if (!invoice) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        const company = await models_1.Company.findOne({ _id: req.user.company_id }).lean();
        res.setHeader("Content-Type", "text/html");
        res.send(buildInvoiceHtml(invoice, company));
    }
    catch (err) {
        console.error("Generate invoice PDF error:", err);
        res.status(500).json({ error: "Failed to generate invoice PDF" });
    }
});
exports.default = router;
//# sourceMappingURL=invoices.js.map