"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../config/prisma"));
const auth_1 = require("../middleware/auth");
const actionLogService_1 = require("../services/actionLogService");
const actionLogService_2 = require("../services/actionLogService");
const router = (0, express_1.Router)();
router.delete('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const qt = await prisma_1.default.quotation.findUnique({ where: { id } });
        if (!qt || qt.companyId !== req.user.company_id) {
            res.status(404).json({ error: 'Quotation not found' });
            return;
        }
        if (qt.status !== 'draft') {
            res.status(400).json({ error: 'Only draft quotations can be deleted' });
            return;
        }
        await prisma_1.default.quotation.delete({ where: { id } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.DELETE, actionLogService_2.ResourceType.QUOTATION, `Deleted quotation ${qt.qtNumber}`, { resourceId: qt.id, resourceName: qt.qtNumber });
        res.json({ message: 'Quotation deleted successfully' });
    }
    catch (err) {
        console.error('Delete quotation error:', err);
        res.status(500).json({ error: 'Failed to delete quotation' });
    }
});
router.post('/:id/duplicate', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const company_id = req.user.company_id;
        const original = await prisma_1.default.quotation.findUnique({ where: { id } });
        if (!original || original.companyId !== company_id) {
            res.status(404).json({ error: 'Quotation not found' });
            return;
        }
        const qtNumber = await generateQTNumber(company_id);
        const copy = await prisma_1.default.quotation.create({
            data: {
                qtNumber,
                clientId: original.clientId,
                client: original.client,
                clientName: original.clientName,
                supplier: original.supplier,
                supplierName: original.supplierName,
                siteId: original.siteId,
                status: 'draft',
                items: original.items,
                subTotal: original.subTotal,
                taxRate: original.taxRate,
                taxAmount: original.taxAmount,
                totalAmount: original.totalAmount,
                validUntil: original.validUntil,
                notes: original.notes,
                terms: original.terms,
                createdById: req.user.id,
                companyId: company_id,
            },
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.CREATE, actionLogService_2.ResourceType.QUOTATION, `Duplicated quotation ${original.qtNumber} → ${qtNumber}`, { resourceId: copy.id, resourceName: qtNumber });
        res.status(201).json({ id: copy.id, qtNumber: copy.qtNumber, message: 'Quotation duplicated' });
    }
    catch (err) {
        console.error('Duplicate quotation error:', err);
        res.status(500).json({ error: 'Failed to duplicate quotation' });
    }
});
router.patch('/:id/send', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const qt = await prisma_1.default.quotation.findUnique({ where: { id } });
        if (!qt || qt.companyId !== req.user.company_id) {
            res.status(404).json({ error: 'Quotation not found' });
            return;
        }
        if (qt.status !== 'draft') {
            res.status(400).json({ error: 'Only draft quotations can be sent' });
            return;
        }
        const updated = await prisma_1.default.quotation.update({ where: { id }, data: { status: 'sent', sentDate: new Date() } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.QUOTATION, `Sent quotation ${updated.qtNumber}`, { resourceId: updated.id, resourceName: updated.qtNumber });
        res.json({ id: updated.id, qtNumber: updated.qtNumber, status: updated.status, sentDate: updated.sentDate, message: 'Quotation sent' });
    }
    catch (err) {
        console.error('Send quotation error:', err);
        res.status(500).json({ error: 'Failed to send quotation' });
    }
});
router.patch('/:id/accept', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const qt = await prisma_1.default.quotation.findUnique({ where: { id } });
        if (!qt || qt.companyId !== req.user.company_id) {
            res.status(404).json({ error: 'Quotation not found' });
            return;
        }
        if (qt.status !== 'sent') {
            res.status(400).json({ error: 'Only sent quotations can be accepted' });
            return;
        }
        const updated = await prisma_1.default.quotation.update({ where: { id }, data: { status: 'accepted' } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.QUOTATION, `Accepted quotation ${updated.qtNumber}`, { resourceId: updated.id, resourceName: updated.qtNumber });
        res.json({ id: updated.id, qtNumber: updated.qtNumber, status: updated.status, message: 'Quotation accepted' });
    }
    catch (err) {
        console.error('Accept quotation error:', err);
        res.status(500).json({ error: 'Failed to accept quotation' });
    }
});
router.patch('/:id/reject', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const qt = await prisma_1.default.quotation.findUnique({ where: { id } });
        if (!qt || qt.companyId !== req.user.company_id) {
            res.status(404).json({ error: 'Quotation not found' });
            return;
        }
        if (qt.status !== 'sent') {
            res.status(400).json({ error: 'Only sent quotations can be rejected' });
            return;
        }
        const updated = await prisma_1.default.quotation.update({ where: { id }, data: { status: 'rejected' } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.UPDATE, actionLogService_2.ResourceType.QUOTATION, `Rejected quotation ${updated.qtNumber}`, { resourceId: updated.id, resourceName: updated.qtNumber });
        res.json({ id: updated.id, qtNumber: updated.qtNumber, status: updated.status, message: 'Quotation rejected' });
    }
    catch (err) {
        console.error('Reject quotation error:', err);
        res.status(500).json({ error: 'Failed to reject quotation' });
    }
});
router.post('/:id/convert', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const company_id = req.user.company_id;
        const qt = await prisma_1.default.quotation.findUnique({ where: { id } });
        if (!qt || qt.companyId !== company_id) {
            res.status(404).json({ error: 'Quotation not found' });
            return;
        }
        if (qt.status !== 'accepted') {
            res.status(400).json({ error: 'Only accepted quotations can be converted to an invoice' });
            return;
        }
        if (qt.convertedToInvoiceId) {
            res.status(400).json({ error: 'This quotation has already been converted to an invoice' });
            return;
        }
        const invoiceNumber = await generateInvoiceNumber(company_id);
        const dueDate = qt.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const qtItems = Array.isArray(qt.items) ? qt.items : [];
        const invoiceItems = qtItems.map((item) => ({
            materialName: item.materialName,
            material_id: item.material_id || null,
            description: item.description || '',
            quantity: item.quantityRequested,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            unit: item.unit,
            notes: item.notes || '',
        }));
        const invoice = await prisma_1.default.invoice.create({
            data: {
                invoiceNumber,
                quotationId: id,
                qtNumber: qt.qtNumber,
                clientId: qt.clientId || null,
                client: qt.client || {},
                clientName: qt.clientName || null,
                siteId: qt.siteId || null,
                status: 'draft',
                items: invoiceItems,
                subTotal: qt.subTotal || 0,
                taxRate: qt.taxRate || 0,
                taxAmount: qt.taxAmount || 0,
                totalAmount: qt.totalAmount || 0,
                amountPaid: 0,
                balanceDue: qt.totalAmount || 0,
                issueDate: new Date(),
                dueDate,
                notes: qt.notes,
                terms: qt.terms,
                createdById: req.user.id,
                companyId: company_id,
            },
        });
        await prisma_1.default.quotation.update({ where: { id }, data: { convertedToInvoiceId: invoice.id } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.CREATE, actionLogService_2.ResourceType.INVOICE, `Converted quotation ${qt.qtNumber} to invoice ${invoiceNumber}`, { resourceId: invoice.id, resourceName: invoiceNumber });
        res.status(201).json({ id: qt.id, qtNumber: qt.qtNumber, convertedToInvoice: { id: invoice.id, invoiceNumber }, message: `Quotation converted to invoice ${invoiceNumber}` });
    }
    catch (err) {
        console.error('Convert quotation error:', err);
        res.status(500).json({ error: 'Failed to convert quotation to invoice' });
    }
});
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
async function generateQTNumber(company_id) {
    const year = new Date().getFullYear();
    const prefix = `QT-${year}-`;
    const last = await prisma_1.default.quotation.findFirst({
        where: { companyId: company_id, qtNumber: { startsWith: prefix } },
        orderBy: { qtNumber: 'desc' },
        select: { qtNumber: true },
    });
    let seq = 1;
    if (last && last.qtNumber) {
        const parts = last.qtNumber.split("-");
        const n = parseInt(parts[2], 10);
        if (!isNaN(n))
            seq = n + 1;
    }
    return `${prefix}${seq.toString().padStart(4, "0")}`;
}
function calculateTotals(items, taxRate = 0) {
    const subTotal = items.reduce((s, i) => s + i.totalPrice, 0);
    const taxAmount = subTotal * (taxRate / 100);
    return { subTotal, taxRate, taxAmount, totalAmount: subTotal + taxAmount };
}
function formatQt(qt) {
    return {
        id: (qt.id ?? qt._id)?.toString(),
        qtNumber: qt.qtNumber,
        client_id: (qt.clientId ?? qt.client_id)?.toString?.() || undefined,
        client: qt.client || null,
        supplier: qt.supplier || null,
        site: qt.siteId ?? qt.site_id,
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
        convertedToInvoice: qt.convertedToInvoice,
        createdBy: qt.createdBy?.name || qt.createdBy,
        createdAt: qt.createdAt,
        updatedAt: qt.updatedAt,
    };
}
function escapePdfText(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)")
        .replace(/[\r\n]+/g, " ");
}
function formatMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}
function wrapText(text, maxLength) {
    const words = String(text || "").split(/\s+/).filter(Boolean);
    const lines = [];
    let current = "";
    for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxLength && current) {
            lines.push(current);
            current = word;
        }
        else {
            current = next;
        }
    }
    if (current)
        lines.push(current);
    return lines.length ? lines : [""];
}
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function formatRwf(value) {
    return Number(value || 0).toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}
function formatQty(value) {
    return Number(value || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}
function formatLongDate(value) {
    const date = value ? new Date(value) : new Date();
    return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}
function buildQuotationHtml(qt, company) {
    const client = (qt.client || {});
    const site = qt.site_id;
    const companyName = escapeHtml(company.name || "Lilstock");
    const companyAddress = escapeHtml(company.address || "");
    const companyPhone = escapeHtml(company.phone || "");
    const companyEmail = escapeHtml(company.email || "");
    const companyWebsite = escapeHtml(company.website || "");
    const companyTin = escapeHtml(company.taxId || "");
    const logoSrc = typeof company.logo === "string" && company.logo.startsWith("data:image/") ? company.logo : "";
    const signatureSrc = typeof company.signatureImage === "string" && company.signatureImage.startsWith("data:image/") ? company.signatureImage : "";
    const stampSrc = typeof company.stampImage === "string" && company.stampImage.startsWith("data:image/") ? company.stampImage : "";
    const footerSrc = typeof company.footerImage === "string" && company.footerImage.startsWith("data:image/") ? company.footerImage : "";
    const taxRate = Number(qt.taxRate || 0);
    const subtotalLabel = taxRate > 0 ? "Total Amount Vat Exclusive" : "Subtotal";
    const validityDays = qt.validUntil
        ? Math.max(1, Math.ceil((new Date(qt.validUntil).getTime() - new Date(qt.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24)))
        : 30;
    const tableItems = Array.isArray(qt.items) ? qt.items : [];
    const firstPageRows = 17;
    const otherPageRows = 12;
    const footerBannerHtml = footerSrc ? `<img class="footer-banner" src="${footerSrc}" alt="Quotation footer image">` : "";
    const pages = [];
    let cursor = 0;
    let currentPageRows = Math.min(firstPageRows, tableItems.length - cursor);
    while (cursor < tableItems.length) {
        pages.push(tableItems.slice(cursor, cursor + currentPageRows));
        cursor += currentPageRows;
        currentPageRows = Math.min(otherPageRows, tableItems.length - cursor);
    }
    const totalPages = pages.length;
    const getRowOffset = (pageIndex) => pages.slice(0, pageIndex).reduce((count, page) => count + page.length, 0);
    const renderTableRows = (items, pageIndex) => items
        .map((item, index) => {
        const rowNumber = getRowOffset(pageIndex) + index + 1;
        return `
          <tr>
            <td class="col-no">${rowNumber}</td>
            <td class="description-cell">${escapeHtml(item.description || item.materialName || "-")}</td>
            <td class="col-unit">${escapeHtml(item.unit || "-")}</td>
            <td class="col-qty">${formatQty(item.quantityRequested)}</td>
            <td class="col-rate">${formatRwf(item.unitPrice)}</td>
            <td class="col-total">${formatRwf(item.totalPrice)}</td>
          </tr>`;
    })
        .join("");
    const renderPage = (pageItems, pageIndex) => {
        const isLastPage = pageIndex === totalPages - 1;
        return `
      <div class="page">
        <div class="document">
          <div class="header">
            <div class="brand">
              ${logoSrc ? `<img class="logo" src="${logoSrc}" alt="${companyName} logo">` : `<div class="logo-fallback">${companyName}</div>`}
            </div>
            <div class="company-info">
              <strong>${companyName}</strong><br>
              ${companyTin ? `TIN: ${companyTin}<br>` : ""}
              ${companyAddress ? `${companyAddress}<br>` : ""}
              ${companyPhone ? `Phone: ${companyPhone}<br>` : ""}
              ${companyEmail ? `Email: ${companyEmail}<br>` : ""}
              ${companyWebsite ? `Website: ${companyWebsite}<br>` : ""}
              ${site?.name ? `Site: ${escapeHtml(site.name)}${site?.location ? `, ${escapeHtml(site.location)}` : ""}` : ""}
              ${totalPages > 1 ? `<div class="page-number">Page ${pageIndex + 1} of ${totalPages}</div>` : ""}
            </div>
          </div>

          <div class="title-band">QUOTATION</div>

          <div class="bill-row">
            <div class="bill-to">
              <div class="bill-label">BILL TO:</div>
              <div class="client-box">
                <strong>${escapeHtml(client.name || "-")}</strong>
                ${client.address ? `<br>${escapeHtml(client.address)}` : ""}
                ${client.phone ? `<br>${escapeHtml(client.phone)}` : ""}
                ${client.email ? `<br>${escapeHtml(client.email)}` : ""}
                ${client.contactPerson ? `<br>${escapeHtml(client.contactPerson)}` : ""}
              </div>
            </div>
            <div class="meta">
              <div class="meta-row"><div class="meta-label">Quote No:</div><div><strong>${escapeHtml(qt.qtNumber)}</strong></div></div>
              <div class="meta-row"><div class="meta-label">Date:</div><div><strong>${formatLongDate(qt.createdAt)}</strong></div></div>
              ${qt.validUntil ? `<div class="meta-row"><div class="meta-label">Valid Until:</div><div>${new Date(qt.validUntil).toLocaleDateString()}</div></div>` : ""}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="col-no">SINO</th>
                <th class="col-desc">DESCRIPTION</th>
                <th class="col-unit">UNIT</th>
                <th class="col-qty">Qty</th>
                <th class="col-rate">Unit rate<br>(RWF)</th>
                <th class="col-total">Total Amount<br>(RWF)</th>
              </tr>
            </thead>
            <tbody>
              ${renderTableRows(pageItems, pageIndex)}
            </tbody>
          </table>

          ${isLastPage ? `
            <div class="terms-total">
              <div class="terms">
                Quote validity : ${validityDays} days<br>
                ${qt.validUntil ? `Valid until : ${new Date(qt.validUntil).toLocaleDateString()}<br>` : ""}
                ${qt.notes ? `${escapeHtml(qt.notes)}<br>` : ""}
                ${qt.terms ? escapeHtml(qt.terms) : "Otherwise terms and conditions apply"}
              </div>
              <div class="totals">
                <table>
                  <tr><td>${subtotalLabel}</td><td>${formatRwf(qt.subTotal)}</td></tr>
                  <tr><td>VAT (${formatQty(taxRate).replace(".00", "")}%)</td><td>${formatRwf(qt.taxAmount)}</td></tr>
                  <tr><td>Total Amount VAT</td><td>${formatRwf(qt.totalAmount)}</td></tr>
                </table>
              </div>
            </div>

            <div class="footer">
              <div class="signature-block">
                ${signatureSrc ? `<img class="signature-image" src="${signatureSrc}" alt="Authorized signature">` : `<div class="signature-placeholder">Authorized Signature</div>`}
                <div class="signature-label">CTS CEO</div>
                ${company.industry ? `<div class="signature-title">${escapeHtml(company.industry)}</div>` : ""}
              </div>
              <div class="stamp">
                ${stampSrc ? `<img class="stamp-image" src="${stampSrc}" alt="${escapeHtml(companyName)} seal">` : `<div class="stamp-mark"><div class="stamp-text">TCS</div></div>`}
              </div>
              <div class="footer-note">
                ${company.description ? `${escapeHtml(company.description)}<br>` : ""}
                ${companyEmail ? `${companyEmail}<br>` : ""}
                ${companyPhone ? companyPhone : ""}
              </div>
            </div>
          ` : ""}

          ${footerBannerHtml}
        </div>
      </div>
    `;
    };
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quotation ${escapeHtml(qt.qtNumber)}</title>
  <style>
    @page { size: A4; margin: 0; }
    html, body { width: 100%; min-height: 297mm; margin: 0; padding: 0; }
    * { box-sizing: border-box; }
    body { background: #f3f4f6; color: #111; font-family: "Times New Roman", Times, serif; }
    .page { width: 100%; max-width: none; margin: 0 auto; padding: 0; page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    .document { width: 100%; border: 2px solid #111; background: #fff; position: relative; padding: 8mm 8mm 8mm; box-sizing: border-box; }
    .header { display: grid; grid-template-columns: 42% 58%; min-height: 138px; border-bottom: 1.5px solid #111; }
    .brand { display: flex; align-items: center; padding: 14px 18px 10px; }
    .logo { max-width: 245px; max-height: 105px; object-fit: contain; }
    .logo-fallback { font-family: Arial, sans-serif; font-size: 38px; font-weight: 800; color: #174f80; letter-spacing: 0.02em; }
    .company-info { padding: 16px 18px 10px; text-align: right; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.38; }
    .company-info strong { font-size: 16px; }
    .page-number { margin-top: 12px; font-weight: 600; font-size: 13px; }
    .title-band { background: #174f80; background-color: #174f80; color: #fff; border-top: 1.5px solid #111; border-bottom: 1.5px solid #111; text-align: center; font-weight: 700; letter-spacing: 0.04em; padding: 3px 8px; font-size: 15px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .bill-row { display: grid; grid-template-columns: 57% 43%; border-bottom: 1.5px solid #111; min-height: 70px; }
    .bill-to { border-right: 1.5px solid #111; display: grid; grid-template-columns: auto 1fr; align-items: center; }
    .bill-label { padding: 6px 12px; font-weight: 700; text-align: center; }
    .client-box { padding: 12px 8px 8px; text-align: left; font-size: 14px; line-height: 1.45; }
    .meta { padding: 10px 18px; font-size: 14px; }
    .meta-row { display: grid; grid-template-columns: 90px 1fr; gap: 12px; margin-bottom: 8px; align-items: center; }
    .meta-label { font-weight: 700; font-style: normal; text-align: right; letter-spacing: 0.01em; }
    table { width: 100%; border-collapse: collapse; border-spacing: 0; table-layout: fixed; font-size: 13px; page-break-inside: auto; border: 1.5px solid #111; }
    thead { display: table-header-group; }
    tbody { display: table-row-group; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td { border: 1.5px solid #111; padding: 5px 5px; vertical-align: top; }
    th:first-child, td:first-child { border-left: 1.5px solid #111; }
    th:first-child, th { border-top: 1.5px solid #111; }
    th { font-weight: 700; text-align: center; }
    .col-no { width: 8%; text-align: right; }
    .col-desc { width: 48%; }
    .col-unit { width: 7%; text-align: center; }
    .col-qty { width: 11%; text-align: right; }
    .col-rate { width: 14%; text-align: right; }
    .col-total { width: 16%; text-align: right; }
    .description-cell { line-height: 1.3; }
    .terms-total { display: grid; grid-template-columns: 63% 37%; border-bottom: 1.5px solid #111; margin-top: 12px; }
    .terms { padding: 5px 4px; min-height: 40px; font-size: 13px; line-height: 1.45; }
    .totals table td { border-bottom: 1.5px solid #174f80; border-right: 1.5px solid #174f80; padding: 4px 8px; font-weight: 700; }
    .totals table td:last-child { border-right: 0; text-align: right; }
    .footer { display: grid; grid-template-columns: 42% 28% 30%; align-items: start; padding: 8px 16px 0; gap: 8px; }
    .footer > * { min-height: 0; }
    .signature-block { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
    .signature-image { width: 100%; max-width: 180px; max-height: 72px; height: auto; object-fit: contain; border-bottom: 1px solid #111; padding-bottom: 6px; }
    .signature-placeholder { width: 100%; max-width: 240px; height: 72px; border-bottom: 1px dashed #374151; display: flex; align-items: flex-end; justify-content: flex-start; padding-bottom: 6px; color: #374151; font-style: italic; }
    .signature-label { font-weight: 700; font-size: 12px; color: #1f2937; }
    .stamp { text-align: center; color: #174f80; font-family: Arial, sans-serif; font-weight: 800; }
    .stamp-mark { position: relative; width: 118px; height: 118px; border: 3px solid #174f80; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; opacity: 0.95; }
    .stamp-mark::before { content: ""; position: absolute; width: 84px; height: 84px; border: 2px solid #174f80; border-radius: 50%; }
    .stamp-mark::after { content: ""; position: absolute; width: 54px; height: 54px; border: 1.75px solid #174f80; border-radius: 50%; }
    .stamp-text { position: relative; font-size: 26px; letter-spacing: 0.18em; }
    .stamp-image { width: 118px; height: 118px; object-fit: contain; border-radius: 50%; }
    .footer-banner { display: block; width: 100%; max-height: 50px; height: auto; object-fit: cover; margin: 8px 0 0; border-radius: 0; page-break-before: auto; break-before: auto; page-break-inside: auto; break-inside: auto; }
    .footer-note { text-align: right; color: #374151; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.4; }
    .no-print { margin-top: 20px; text-align: center; }
    .print-button { padding: 10px 24px; border: 0; border-radius: 6px; background: #174f80; color: #fff; cursor: pointer; font-family: Arial, sans-serif; }
    @media print {
      html, body { width: 100%; height: 100%; margin: 0; padding: 0; }
      body { background: #fff; }
      .page { width: 100%; max-width: none; margin: 0; padding: 0; }
      .document { width: 100%; border: 2px solid #111; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${pages.map(renderPage).join("")}
  <div class="no-print">
    <button class="print-button" onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;
}
function buildQuotationPdf(qt) {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 48;
    const lineHeight = 15;
    const bottom = 56;
    const pages = [[]];
    let y = pageHeight - margin;
    const addPage = () => {
        pages.push([]);
        y = pageHeight - margin;
    };
    const addText = (text, x = margin, size = 10, bold = false) => {
        if (y < bottom)
            addPage();
        pages[pages.length - 1].push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`);
        y -= lineHeight;
    };
    const addGap = (amount = 8) => {
        y -= amount;
        if (y < bottom)
            addPage();
    };
    addText("QUOTATION", margin, 20, true);
    addText(qt.qtNumber, margin, 13, true);
    addText(`Status: ${qt.status.toUpperCase()}`, margin, 10);
    addGap();
    const client = (qt.client || {});
    addText("Client", margin, 12, true);
    if (client.name)
        addText(client.name);
    if (client.contactPerson)
        addText(`Contact: ${client.contactPerson}`);
    if (client.email)
        addText(`Email: ${client.email}`);
    if (client.phone)
        addText(`Phone: ${client.phone}`);
    if (client.address)
        addText(`Address: ${client.address}`);
    addGap();
    const site = qt.site_id;
    addText("Details", margin, 12, true);
    if (site?.name)
        addText(`Site: ${site.name}${site.location ? `, ${site.location}` : ""}`);
    addText(`Created: ${qt.createdAt ? new Date(qt.createdAt).toLocaleDateString() : ""}`);
    if (qt.validUntil)
        addText(`Valid Until: ${new Date(qt.validUntil).toLocaleDateString()}`);
    if (qt.sentDate)
        addText(`Sent Date: ${new Date(qt.sentDate).toLocaleDateString()}`);
    addGap();
    addText("Items", margin, 12, true);
    addText("Material                                         Qty      Unit     Unit Price     Total", margin, 9, true);
    addText("--------------------------------------------------------------------------------", margin, 9);
    qt.items.forEach((item, index) => {
        const materialLines = wrapText(`${index + 1}. ${item.materialName}`, 44);
        const firstLine = materialLines[0].padEnd(46, " ");
        addText(`${firstLine}${String(item.quantityRequested).padStart(8, " ")}  ${String(item.unit).padEnd(7, " ")} ${formatMoney(item.unitPrice).padStart(11, " ")} ${formatMoney(item.totalPrice).padStart(11, " ")}`, margin, 9);
        materialLines.slice(1).forEach((line) => addText(`   ${line}`, margin, 9));
        if (item.notes) {
            wrapText(`Notes: ${item.notes}`, 78).forEach((line) => addText(`   ${line}`, margin, 8));
        }
    });
    addGap();
    addText(`Subtotal: ${formatMoney(qt.subTotal)}`, 390, 10);
    addText(`Tax (${qt.taxRate || 0}%): ${formatMoney(qt.taxAmount)}`, 390, 10);
    addText(`Total: ${formatMoney(qt.totalAmount)}`, 390, 12, true);
    if (qt.notes) {
        addGap();
        addText("Notes", margin, 12, true);
        wrapText(qt.notes, 90).forEach((line) => addText(line, margin, 9));
    }
    if (qt.terms) {
        addGap();
        addText("Terms & Conditions", margin, 12, true);
        wrapText(qt.terms, 90).forEach((line) => addText(line, margin, 9));
    }
    const objects = [];
    const addObject = (body) => {
        objects.push(body);
        return objects.length;
    };
    const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesId = 2;
    objects.push("");
    const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds = [];
    for (const pageLines of pages) {
        const content = pageLines.join("\n");
        const contentId = addObject(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
        const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
        pageIds.push(pageId);
    }
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((body, index) => {
        offsets.push(Buffer.byteLength(pdf, "utf8"));
        pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i < offsets.length; i += 1) {
        pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
}
// Legacy Mongoose-backed list/get/create/update routes removed during migration.
// Prisma-backed handlers remain above; if you need list/create/update implemented
// with Prisma, I can add them next.
// Convert accepted quotation to invoice
router.post("/:id/convert", auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const id = String(req.params.id);
        const company_id = req.user.company_id;
        const qt = await prisma_1.default.quotation.findUnique({ where: { id } });
        if (!qt || qt.companyId !== company_id) {
            res.status(404).json({ error: "Quotation not found" });
            return;
        }
        if (qt.status !== "accepted") {
            res.status(400).json({
                error: "Only accepted quotations can be converted to an invoice",
            });
            return;
        }
        if (qt.convertedToInvoiceId) {
            res.status(400).json({
                error: "This quotation has already been converted to an invoice",
            });
            return;
        }
        const invoiceNumber = await generateInvoiceNumber(company_id);
        const dueDate = qt.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const qtItems = Array.isArray(qt.items) ? qt.items : [];
        const invoiceItems = qtItems.map((item) => ({
            materialName: item.materialName,
            material_id: item.material_id || null,
            description: item.description || "",
            quantity: item.quantityRequested,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            unit: item.unit,
            notes: item.notes || "",
        }));
        const invoice = await prisma_1.default.invoice.create({
            data: {
                invoiceNumber,
                quotationId: id,
                qtNumber: qt.qtNumber,
                clientId: qt.clientId || null,
                client: qt.client || {},
                siteId: qt.siteId || null,
                status: 'draft',
                items: invoiceItems,
                subTotal: qt.subTotal || 0,
                taxRate: qt.taxRate || 0,
                taxAmount: qt.taxAmount || 0,
                totalAmount: qt.totalAmount || 0,
                amountPaid: 0,
                balanceDue: qt.totalAmount || 0,
                issueDate: new Date(),
                dueDate,
                notes: qt.notes,
                terms: qt.terms,
                createdById: req.user.id,
                companyId: company_id,
            },
        });
        await prisma_1.default.quotation.update({ where: { id }, data: { convertedToInvoiceId: invoice.id } });
        await actionLogService_1.ActionLogService.logFromRequest(req, actionLogService_2.ActionType.CREATE, actionLogService_2.ResourceType.INVOICE, `Converted quotation ${qt.qtNumber} to invoice ${invoiceNumber}`, { resourceId: invoice.id, resourceName: invoiceNumber });
        res.status(201).json({
            id: qt.id,
            qtNumber: qt.qtNumber,
            convertedToInvoice: { id: invoice.id, invoiceNumber },
            message: `Quotation converted to invoice ${invoiceNumber}`,
        });
    }
    catch (err) {
        console.error("Convert quotation error:", err);
        res.status(500).json({ error: "Failed to convert quotation to invoice" });
    }
});
exports.default = router;
//# sourceMappingURL=quotations.js.map