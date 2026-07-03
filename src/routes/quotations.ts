import { Router } from "express";
import { Company, Quotation, Invoice, Site, Client } from "../models";
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

async function generateInvoiceNumber(company_id: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const last = await Invoice.findOne(
    { company_id, invoiceNumber: { $regex: `^${prefix}` } },
    { invoiceNumber: 1 },
  ).sort({ invoiceNumber: -1 });
  let seq = 1;
  if (last) {
    const n = parseInt(last.invoiceNumber.split("-")[2], 10);
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
    client_id: (qt.client_id as any)?.toString?.() || undefined,
    client: qt.client || null,
    supplier: qt.supplier || null,
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
    convertedToInvoice: qt.convertedToInvoice,
    createdBy: (qt.createdBy as any)?.name || qt.createdBy,
    createdAt: qt.createdAt,
    updatedAt: qt.updatedAt,
  };
}

function escapePdfText(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

function formatMoney(value: number | undefined): string {
  return `$${Number(value || 0).toFixed(2)}`;
}

function wrapText(text: string, maxLength: number): string[] {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatRwf(value: number | undefined): string {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatQty(value: number | undefined): string {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatLongDate(value?: Date): string {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function buildQuotationHtml(qt: IQuotation, company: { name?: string; logo?: string; address?: string; phone?: string; email?: string; website?: string; taxId?: string; industry?: string; description?: string }): string {
  const client = (qt.client || {}) as {
    name?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  const site = qt.site_id as any;
  const companyName = escapeHtml(company.name || "Lilstock");
  const companyAddress = escapeHtml(company.address || "");
  const companyPhone = escapeHtml(company.phone || "");
  const companyEmail = escapeHtml(company.email || "");
  const companyWebsite = escapeHtml(company.website || "");
  const companyTin = escapeHtml(company.taxId || "");
  const logoSrc = typeof company.logo === "string" && company.logo.startsWith("data:image/") ? company.logo : "";
  const taxRate = Number(qt.taxRate || 0);
  const subtotalLabel = taxRate > 0 ? "Total Amount Vat Exclusive" : "Subtotal";
  const validityDays = qt.validUntil
    ? Math.max(1, Math.ceil((new Date(qt.validUntil).getTime() - new Date(qt.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24)))
    : 30;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quotation ${escapeHtml(qt.qtNumber)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #f3f4f6; color: #111; font-family: "Times New Roman", Times, serif; }
    .page { width: 100%; max-width: 980px; margin: 0 auto; padding: 28px; background: #fff; }
    .document { border: 2px solid #111; min-height: 900px; background: #fff; }
    .header { display: grid; grid-template-columns: 42% 58%; min-height: 138px; border-bottom: 1.5px solid #111; }
    .brand { display: flex; align-items: center; padding: 14px 18px 10px; }
    .logo { max-width: 245px; max-height: 105px; object-fit: contain; }
    .logo-fallback { font-family: Arial, sans-serif; font-size: 38px; font-weight: 800; color: #174f80; letter-spacing: 0.02em; }
    .company-info { padding: 16px 18px 10px; text-align: right; font-family: Arial, sans-serif; font-size: 14px; line-height: 1.38; }
    .company-info strong { font-size: 16px; }
    .title-band { background: #174f80; color: #fff; border-top: 1.5px solid #111; border-bottom: 1.5px solid #111; text-align: center; font-weight: 700; letter-spacing: 0.04em; padding: 3px 8px; font-size: 15px; }
    .bill-row { display: grid; grid-template-columns: 57% 43%; border-bottom: 1.5px solid #111; min-height: 70px; }
    .bill-to { border-right: 1.5px solid #111; display: grid; grid-template-columns: 120px 1fr; }
    .bill-label { padding: 6px 12px; font-weight: 700; text-align: center; }
    .client-box { padding: 12px 10px 8px; text-align: center; font-size: 14px; }
    .meta { padding: 10px 18px; font-size: 14px; }
    .meta-row { display: grid; grid-template-columns: 95px 1fr; gap: 10px; margin-bottom: 8px; }
    .meta-label { font-weight: 700; font-style: italic; text-align: right; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 13px; }
    th, td { border-right: 1.5px solid #111; border-bottom: 1.5px solid #111; padding: 5px 5px; vertical-align: top; }
    th:last-child, td:last-child { border-right: 0; }
    th { font-weight: 700; text-align: center; }
    .col-no { width: 8%; text-align: right; }
    .col-desc { width: 48%; }
    .col-unit { width: 7%; text-align: center; }
    .col-qty { width: 11%; text-align: right; }
    .col-rate { width: 14%; text-align: right; }
    .col-total { width: 16%; text-align: right; }
    .description-cell { line-height: 1.3; }
    .terms-total { display: grid; grid-template-columns: 63% 37%; border-bottom: 1.5px solid #111; }
    .terms { padding: 5px 4px; min-height: 58px; font-size: 13px; line-height: 1.45; }
    .totals table td { border-bottom: 1.5px solid #174f80; border-right: 1.5px solid #174f80; padding: 4px 8px; font-weight: 700; }
    .totals table td:last-child { border-right: 0; text-align: right; }
    .footer { min-height: 140px; display: grid; grid-template-columns: 45% 25% 30%; align-items: center; padding: 16px 72px; gap: 18px; }
    .signature-name { font-weight: 700; font-size: 14px; line-height: 1.3; }
    .signature-title { font-weight: 700; font-size: 14px; line-height: 1.3; margin-top: 4px; }
    .stamp { text-align: center; color: #174f80; font-family: Arial, sans-serif; font-weight: 800; }
    .stamp-mark { width: 98px; height: 98px; border: 3px solid #174f80; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 26px; opacity: 0.75; }
    .footer-note { text-align: right; color: #374151; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.4; }
    .no-print { margin-top: 20px; text-align: center; }
    .print-button { padding: 10px 24px; border: 0; border-radius: 6px; background: #174f80; color: #fff; cursor: pointer; font-family: Arial, sans-serif; }
    @media print {
      body { background: #fff; }
      .page { padding: 0; max-width: none; }
      .no-print { display: none; }
      .document { min-height: calc(100vh - 2px); }
    }
  </style>
</head>
<body>
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
        </div>
      </div>

      <div class="title-band">DISCOUNTED QUOTATION</div>

      <div class="bill-row">
        <div class="bill-to">
          <div class="bill-label">BILL TO:</div>
          <div class="client-box">
            <strong>${escapeHtml(client.name || "-")}</strong>
            ${client.contactPerson ? `<br>${escapeHtml(client.contactPerson)}` : ""}
            ${client.email ? `<br>${escapeHtml(client.email)}` : ""}
            ${client.phone ? `<br>${escapeHtml(client.phone)}` : ""}
            ${client.address ? `<br>${escapeHtml(client.address)}` : ""}
          </div>
        </div>
        <div class="meta">
          <div class="meta-row"><div class="meta-label">Date:</div><div><strong>${formatLongDate(qt.createdAt)}</strong></div></div>
          <div class="meta-row"><div class="meta-label">Quote No:</div><div><strong>${escapeHtml(qt.qtNumber)}</strong></div></div>
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
          ${qt.items.map((item: any, index: number) => `
          <tr>
            <td class="col-no">${index + 1}</td>
            <td class="description-cell">${escapeHtml(item.description || item.materialName || "-")}</td>
            <td class="col-unit">${escapeHtml(item.unit || "-")}</td>
            <td class="col-qty">${formatQty(item.quantityRequested)}</td>
            <td class="col-rate">${formatRwf(item.unitPrice)}</td>
            <td class="col-total">${formatRwf(item.totalPrice)}</td>
          </tr>`).join("")}
        </tbody>
      </table>

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
        <div>
          <div class="signature-name">${escapeHtml((qt.createdBy as any)?.name || "Authorized Person")}</div>
          <div class="signature-title">For ${companyName}</div>
          ${company.industry ? `<div class="signature-title">${escapeHtml(company.industry)}</div>` : ""}
        </div>
        <div class="stamp"><div class="stamp-mark">${escapeHtml((company.name || "LS").slice(0, 3).toUpperCase())}</div></div>
        <div class="footer-note">
          ${company.description ? `${escapeHtml(company.description)}<br>` : ""}
          ${companyEmail ? `${companyEmail}<br>` : ""}
          ${companyPhone ? companyPhone : ""}
        </div>
      </div>
    </div>

    <div class="no-print">
      <button class="print-button" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;
}
function buildQuotationPdf(qt: IQuotation): Buffer {
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 48;
  const lineHeight = 15;
  const bottom = 56;
  const pages: string[][] = [[]];
  let y = pageHeight - margin;

  const addPage = () => {
    pages.push([]);
    y = pageHeight - margin;
  };

  const addText = (text: unknown, x = margin, size = 10, bold = false) => {
    if (y < bottom) addPage();
    pages[pages.length - 1].push(
      `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`,
    );
    y -= lineHeight;
  };

  const addGap = (amount = 8) => {
    y -= amount;
    if (y < bottom) addPage();
  };

  addText("QUOTATION", margin, 20, true);
  addText(qt.qtNumber, margin, 13, true);
  addText(`Status: ${qt.status.toUpperCase()}`, margin, 10);
  addGap();

  const client = (qt.client || {}) as {
    name?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  addText("Client", margin, 12, true);
  if (client.name) addText(client.name);
  if (client.contactPerson) addText(`Contact: ${client.contactPerson}`);
  if (client.email) addText(`Email: ${client.email}`);
  if (client.phone) addText(`Phone: ${client.phone}`);
  if (client.address) addText(`Address: ${client.address}`);
  addGap();

  const site = qt.site_id as any;
  addText("Details", margin, 12, true);
  if (site?.name) addText(`Site: ${site.name}${site.location ? `, ${site.location}` : ""}`);
  addText(`Created: ${qt.createdAt ? new Date(qt.createdAt).toLocaleDateString() : ""}`);
  if (qt.validUntil) addText(`Valid Until: ${new Date(qt.validUntil).toLocaleDateString()}`);
  if (qt.sentDate) addText(`Sent Date: ${new Date(qt.sentDate).toLocaleDateString()}`);
  addGap();

  addText("Items", margin, 12, true);
  addText("Material                                         Qty      Unit     Unit Price     Total", margin, 9, true);
  addText("--------------------------------------------------------------------------------", margin, 9);

  qt.items.forEach((item: any, index: number) => {
    const materialLines = wrapText(`${index + 1}. ${item.materialName}`, 44);
    const firstLine = materialLines[0].padEnd(46, " ");
    addText(
      `${firstLine}${String(item.quantityRequested).padStart(8, " ")}  ${String(item.unit).padEnd(7, " ")} ${formatMoney(item.unitPrice).padStart(11, " ")} ${formatMoney(item.totalPrice).padStart(11, " ")}`,
      margin,
      9,
    );
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

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = 2;
  objects.push("");
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds: number[] = [];
  for (const pageLines of pages) {
    const content = pageLines.join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
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

// ── GET / — List ──────────────────────────────────────────────────────────────

router.get("/", authenticateToken, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const {
      status,
      siteId,
      supplier,
      client,
      clientId,
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
    if (clientId && mongoose.Types.ObjectId.isValid(clientId as string))
      where.client_id = new mongoose.Types.ObjectId(clientId as string);
    if (client) where["client.name"] = { $regex: client, $options: "i" };
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

router.get("/:id/pdf", authenticateToken, async (req, res): Promise<void> => {
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

    const company = (await Company.findOne({ company_id: req.user!.company_id }).lean()) ||
      (mongoose.Types.ObjectId.isValid(req.user!.company_id)
        ? await Company.findById(req.user!.company_id).lean()
        : null) ||
      (await Company.findOne({ name: "Lilstock" }).lean()) ||
      {};
    const html = buildQuotationHtml(qt as IQuotation, company as any);
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err) {
    console.error("Generate quotation PDF error:", err);
    res.status(500).json({ error: "Failed to generate quotation PDF" });
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
        client_id,
        supplier,
        site_id,
        items,
        taxRate = 0,
        validUntil,
        notes,
        terms,
      } = req.body;

      if (!client_id || !items?.length) {
        res.status(400).json({ error: "Client and items are required" });
        return;
      }

      if (!mongoose.Types.ObjectId.isValid(client_id)) {
        res.status(400).json({ error: "Invalid client ID" });
        return;
      }

      const client = await Client.findOne({
        _id: new mongoose.Types.ObjectId(client_id),
        company_id,
      }).lean();

      if (!client) {
        res.status(404).json({ error: "Client not found" });
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
        client_id: new mongoose.Types.ObjectId(client_id),
        client: {
          name: client.name,
          contactPerson: client.contactPerson || "",
          email: client.email || "",
          phone: client.phone || "",
          address: client.address || "",
        },
        supplier: supplier || {},
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
        `Created quotation ${qtNumber} for ${client.name}`,
        { resourceId: qt._id.toString(), resourceName: qtNumber },
      );

      res.status(201).json({
        id: qt._id.toString(),
        qtNumber: qt.qtNumber,
        client_id: qt.client_id?.toString(),
        client: qt.client,
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

      if (supplier) {
        qt.supplier = supplier;
      }
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
        client_id: qt.client_id?.toString(),
        client: qt.client,
        supplier: qt.supplier,
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
        `Sent quotation ${qt.qtNumber} to ${qt.client?.name || qt.supplier?.name || "recipient"}`,
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

// Convert accepted quotation to invoice

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
          error: "Only accepted quotations can be converted to an invoice",
        });
        return;
      }
      if (qt.convertedToInvoice) {
        res.status(400).json({
          error: "This quotation has already been converted to an invoice",
        });
        return;
      }

      const invoiceNumber = await generateInvoiceNumber(company_id);
      const dueDate = qt.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const invoiceItems = qt.items.map((item: any) => ({
        materialName: item.materialName,
        material_id: item.material_id || null,
        description: item.description || "",
        quantity: item.quantityRequested,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        unit: item.unit,
        notes: item.notes || "",
      }));

      const invoice = (await Invoice.create({
        invoiceNumber,
        quotation_id: (qt as any)._id,
        qtNumber: qt.qtNumber,
        client_id: qt.client_id || undefined,
        client: {
          name: qt.client?.name || qt.supplier?.name || "Client",
          contactPerson: qt.client?.contactPerson || qt.supplier?.contactPerson || "",
          email: qt.client?.email || qt.supplier?.email || "",
          phone: qt.client?.phone || qt.supplier?.phone || "",
          address: qt.client?.address || qt.supplier?.address || "",
        },
        site_id: qt.site_id || undefined,
        status: "draft",
        items: invoiceItems,
        subTotal: qt.subTotal,
        taxRate: qt.taxRate,
        taxAmount: qt.taxAmount,
        totalAmount: qt.totalAmount,
        amountPaid: 0,
        balanceDue: qt.totalAmount,
        issueDate: new Date(),
        dueDate,
        notes: qt.notes,
        terms: qt.terms,
        createdBy: new mongoose.Types.ObjectId(req.user!.id),
        company_id,
      })) as any;

      qt.convertedToInvoice = invoice._id as mongoose.Types.ObjectId;
      await qt.save();

      await ActionLogService.logFromRequest(
        req,
        ActionType.CREATE,
        ResourceType.INVOICE,
        `Converted quotation ${qt.qtNumber} to invoice ${invoiceNumber}`,
        { resourceId: invoice._id.toString(), resourceName: invoiceNumber },
      );

      res.status(201).json({
        id: (qt as any)._id.toString(),
        qtNumber: qt.qtNumber,
        convertedToInvoice: { id: invoice._id.toString(), invoiceNumber },
        message: `Quotation converted to invoice ${invoiceNumber}`,
      });
    } catch (err) {
      console.error("Convert quotation error:", err);
      res.status(500).json({ error: "Failed to convert quotation to invoice" });
    }
  },
);
export default router;




