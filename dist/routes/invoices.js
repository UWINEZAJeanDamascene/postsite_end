"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateInvoiceNumber = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const actionLogService_1 = require("../services/actionLogService");
const actionLogService_2 = require("../services/actionLogService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
async function generateInvoiceNumber(company_id) {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const last = await prisma_1.default.invoice.findFirst({
        where: { companyId: company_id, invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: 'desc' },
        select: { invoiceNumber: true },
    });
    let seq = 1;
    if (last && last.invoiceNumber) {
        const parts = last.invoiceNumber.split("-");
        const n = parseInt(parts[2], 10);
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
    const id = invoice.id || (invoice._id ? invoice._id.toString() : undefined);
    const createdByName = invoice.createdBy?.name || invoice.createdByName || (invoice.createdBy && typeof invoice.createdBy === 'string' ? invoice.createdBy : undefined);
    return {
        id,
        invoiceNumber: invoice.invoiceNumber,
        quotation_id: invoice.quotationId || invoice.quotation_id,
        qtNumber: invoice.qtNumber,
        client_id: invoice.clientId || invoice.client_id,
        client: invoice.client,
        site: invoice.site || invoice.site_id || invoice.siteId,
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
        createdBy: createdByName,
        createdAt: invoice.createdAt || invoice.createdAt,
        updatedAt: invoice.updatedAt || invoice.updatedAt,
    };
}
function formatMoney(value) {
    return `RWF ${Number(value || 0).toFixed(2)}`;
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
        const where = { companyId: company_id };
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds?.length) {
                res.json({ records: [], total: 0, page: 1, totalPages: 0 });
                return;
            }
            where.siteId = { in: req.assignedSiteIds };
        }
        if (status && status !== "all")
            where.status = status;
        if (client)
            where.clientName = { contains: client, };
        if (clientId)
            where.clientId = clientId;
        if (siteId)
            where.siteId = siteId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const [records, total] = await Promise.all([
            prisma_1.default.invoice.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
                include: { site: { select: { name: true, location: true } }, createdBy: { select: { name: true } } },
            }),
            prisma_1.default.invoice.count({ where }),
        ]);
        res.json({ records: records.map((inv) => formatInvoice(inv)), total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    }
    catch (err) {
        console.error("Get invoices error:", err);
        res.status(500).json({ error: "Failed to fetch invoices" });
    }
});
router.get("/stats/overview", auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const byStatusRows = await prisma_1.default.invoice.groupBy({
            by: ['status'],
            where: { companyId: company_id },
            _count: { _all: true },
            _sum: { totalAmount: true, balanceDue: true },
        });
        const byStatus = {};
        byStatusRows.forEach((row) => {
            byStatus[row.status] = {
                count: row._count?._all || 0,
                value: row._sum?.totalAmount || 0,
                balanceDue: row._sum?.balanceDue || 0,
            };
        });
        const totals = await prisma_1.default.invoice.aggregate({
            where: { companyId: company_id },
            _count: { _all: true },
            _sum: { totalAmount: true, balanceDue: true },
        });
        res.json({
            total: totals._count?._all || 0,
            byStatus,
            totalValue: totals._sum?.totalAmount || 0,
            outstandingValue: totals._sum?.balanceDue || 0,
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
        const invoice = await prisma_1.default.invoice.findUnique({ where: { id }, include: { site: true, createdBy: true } });
        if (!invoice || invoice.companyId !== req.user.company_id) {
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
        const client = await prisma_1.default.client.findUnique({ where: { id: client_id } });
        if (!client) {
            res.status(404).json({ error: "Client not found" });
            return;
        }
        if (site_id) {
            const site = await prisma_1.default.site.findUnique({ where: { id: site_id } });
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
        const invoice = await prisma_1.default.invoice.create({
            data: {
                invoiceNumber,
                clientId: client_id,
                client: client,
                siteId: site_id || null,
                status: 'draft',
                items: processedItems,
                subTotal: totals.subTotal,
                taxRate: totals.taxRate,
                taxAmount: totals.taxAmount,
                totalAmount: totals.totalAmount,
                amountPaid: 0,
                balanceDue: totals.totalAmount,
                issueDate: new Date(),
                dueDate: dueDate ? new Date(dueDate) : undefined,
                notes,
                terms,
                createdById: req.user.id,
                companyId: company_id,
            },
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.CREATE, actionLogService_2.ResourceType.INVOICE, `Created invoice ${invoiceNumber} for ${client.name}`, { resourceId: invoice.id, resourceName: invoiceNumber });
        res.status(201).json({ ...formatInvoice(invoice), message: "Invoice created successfully" });
    }
    catch (err) {
        console.error("Create invoice error:", err);
        res.status(500).json({ error: "Failed to create invoice" });
    }
});
router.patch("/:id/send", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const invoice = await prisma_1.default.invoice.findUnique({ where: { id } });
        if (!invoice || invoice.companyId !== req.user.company_id) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        if (invoice.status !== "draft") {
            res.status(400).json({ error: "Only draft invoices can be sent" });
            return;
        }
        const updated = await prisma_1.default.invoice.update({ where: { id }, data: { status: 'sent', sentDate: new Date() }, include: { site: true, createdBy: true } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.INVOICE, `Sent invoice ${updated.invoiceNumber}`, {
            resourceId: updated.id,
            resourceName: updated.invoiceNumber,
        });
        res.json({ ...formatInvoice(updated), message: "Invoice sent" });
    }
    catch (err) {
        console.error("Send invoice error:", err);
        res.status(500).json({ error: "Failed to send invoice" });
    }
});
router.patch("/:id/pay", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const invoice = await prisma_1.default.invoice.findUnique({ where: { id } });
        if (!invoice || invoice.companyId !== req.user.company_id) {
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
        const data = { amountPaid, balanceDue: Math.max(invoice.totalAmount - amountPaid, 0) };
        if (data.balanceDue === 0) {
            data.status = 'paid';
            data.paidDate = new Date();
        }
        const updated = await prisma_1.default.invoice.update({ where: { id }, data, include: { site: true, createdBy: true } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.INVOICE, `Recorded payment for invoice ${updated.invoiceNumber}`, {
            resourceId: updated.id,
            resourceName: updated.invoiceNumber,
        });
        res.json({ ...formatInvoice(updated), message: "Invoice payment recorded" });
    }
    catch (err) {
        console.error("Pay invoice error:", err);
        res.status(500).json({ error: "Failed to record invoice payment" });
    }
});
router.patch("/:id/cancel", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const invoice = await prisma_1.default.invoice.findUnique({ where: { id } });
        if (!invoice || invoice.companyId !== req.user.company_id) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        if (invoice.status === "paid") {
            res.status(400).json({ error: "Paid invoices cannot be cancelled" });
            return;
        }
        const updated = await prisma_1.default.invoice.update({ where: { id }, data: { status: 'cancelled' }, include: { site: true, createdBy: true } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.INVOICE, `Cancelled invoice ${updated.invoiceNumber}`, {
            resourceId: updated.id,
            resourceName: updated.invoiceNumber,
        });
        res.json({ ...formatInvoice(updated), message: "Invoice cancelled" });
    }
    catch (err) {
        console.error("Cancel invoice error:", err);
        res.status(500).json({ error: "Failed to cancel invoice" });
    }
});
router.get("/:id/pdf", auth_1.authenticateToken, async (req, res) => {
    try {
        const id = String(req.params.id);
        const invoice = await prisma_1.default.invoice.findUnique({ where: { id }, include: { site: true } });
        if (!invoice || invoice.companyId !== req.user.company_id) {
            res.status(404).json({ error: "Invoice not found" });
            return;
        }
        const company = await prisma_1.default.company.findUnique({ where: { id: req.user.company_id } });
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