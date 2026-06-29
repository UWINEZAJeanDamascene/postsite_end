import { Router } from "express";
import { Company, Quotation, PurchaseOrder, Site, Client } from "../models";
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

function buildQuotationHtml(qt: IQuotation, company: { name?: string; address?: string; phone?: string; email?: string; website?: string; taxId?: string; industry?: string; description?: string }): string {
  const site = qt.site_id as any;
  const client = (qt.client || {}) as {
    name?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
  };

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quotation ${qt.qtNumber}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body { font-family: Inter, Arial, sans-serif; margin: 0; color: #1f2937; background: #fff; }
    .page { width: 100%; max-width: 920px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 32px; }
    .title-block { max-width: 65%; }
    .title { margin: 0; font-size: 34px; letter-spacing: 0.12em; text-transform: uppercase; }
    .subtitle { margin: 10px 0 0; font-size: 16px; color: #4b5563; }
    .meta-block { text-align: right; }
    .status { display: inline-flex; align-items: center; justify-content: center; min-width: 120px; padding: 10px 18px; border-radius: 999px; background: #f3f4f6; color: #111827; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 12px; font-weight: 700; margin-bottom: 14px; color: #475569; text-transform: uppercase; letter-spacing: 0.12em; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    .info-block { padding: 22px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 16px; }
    .info-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 10px; }
    .info-row:last-child { margin-bottom: 0; }
    .label { color: #6b7280; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; white-space: nowrap; }
    .value { font-weight: 700; color: #111827; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 14px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
    th { background: #eef2ff; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; color: #334155; }
    td.text-right { text-align: right; }
    .totals { margin-top: 24px; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
    .total-row { display: flex; gap: 18px; font-size: 14px; }
    .total-row strong { min-width: 150px; text-align: right; display: inline-block; }
    .total-amount { font-size: 17px; font-weight: 700; }
    .footer { margin-top: 42px; padding-top: 22px; border-top: 1px solid #e5e7eb; text-align: center; color: #6b7280; font-size: 12px; }
    .no-print { margin-top: 32px; text-align: center; }
    .print-button { padding: 10px 28px; border: none; border-radius: 8px; background: #2563eb; color: #fff; cursor: pointer; font-size: 14px; }
    @media print { .page { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="title-block">
        <h1 class="title">Quotation</h1>
        <p class="subtitle">${qt.qtNumber}</p>
      </div>
      <div class="meta-block">
        <div class="status">${qt.status?.toUpperCase() || "DRAFT"}</div>
        ${qt.createdAt ? `<p style="margin: 16px 0 0; font-size: 13px; color: #4b5563;">Created ${new Date(qt.createdAt).toLocaleDateString()}</p>` : ""}
      </div>
    </div>

    <div class="section info-grid">
      <div class="info-block">
        <div class="section-title">Client</div>
        <div class="info-row"><span class="label">Name</span><span class="value">${client.name || "-"}</span></div>
        ${client.contactPerson ? `<div class="info-row"><span class="label">Contact</span><span class="value">${client.contactPerson}</span></div>` : ""}
        ${client.email ? `<div class="info-row"><span class="label">Email</span><span class="value">${client.email}</span></div>` : ""}
        ${client.phone ? `<div class="info-row"><span class="label">Phone</span><span class="value">${client.phone}</span></div>` : ""}
        ${client.address ? `<div class="info-row"><span class="label">Address</span><span class="value">${client.address}</span></div>` : ""}
      </div>
      <div class="info-block">
        <div class="section-title">Company</div>
        <div class="info-row"><span class="label">Name</span><span class="value">${company.name || "-"}</span></div>
        ${company.email ? `<div class="info-row"><span class="label">Email</span><span class="value">${company.email}</span></div>` : ""}
        ${company.phone ? `<div class="info-row"><span class="label">Phone</span><span class="value">${company.phone}</span></div>` : ""}
        ${company.address ? `<div class="info-row"><span class="label">Address</span><span class="value">${company.address}</span></div>` : ""}
        ${company.website ? `<div class="info-row"><span class="label">Website</span><span class="value">${company.website}</span></div>` : ""}
        ${company.taxId ? `<div class="info-row"><span class="label">Tax ID</span><span class="value">${company.taxId}</span></div>` : ""}
        ${company.industry ? `<div class="info-row"><span class="label">Industry</span><span class="value">${company.industry}</span></div>` : ""}
      </div>
    </div>

    <div class="section">
      <div class="section-title">Items</div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Material</th>
            <th>Description</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Unit</th>
            <th class="text-right">Unit Price</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${qt.items
            .map(
              (item: any, index: number) => `
          <tr>
            <td>${index + 1}</td>
            <td><strong>${item.materialName || "-"}</strong></td>
            <td>${item.description || "-"}</td>
            <td class="text-right">${item.quantityRequested ?? 0}</td>
            <td class="text-right">${item.unit || "-"}</td>
            <td class="text-right">$${Number(item.unitPrice ?? 0).toFixed(2)}</td>
            <td class="text-right">$${Number(item.totalPrice ?? 0).toFixed(2)}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row"><strong>Subtotal:</strong> $${Number(qt.subTotal ?? 0).toFixed(2)}</div>
        <div class="total-row"><strong>Tax (${Number(qt.taxRate ?? 0).toFixed(2)}%):</strong> $${Number(qt.taxAmount ?? 0).toFixed(2)}</div>
        <div class="total-row total-amount"><strong>Total:</strong> $${Number(qt.totalAmount ?? 0).toFixed(2)}</div>
      </div>
    </div>

    ${qt.notes ? `
    <div class="section">
      <div class="section-title">Notes</div>
      <p>${qt.notes}</p>
    </div>
    ` : ""}

    ${qt.terms ? `
    <div class="section">
      <div class="section-title">Terms & Conditions</div>
      <p>${qt.terms}</p>
    </div>
    ` : ""}
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

    const company = await Company.findOne({ company_id: req.user!.company_id }).lean() || {};
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
