"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyData = exports.mapLegacyNotificationToPrisma = exports.mapLegacyActionLogToPrisma = exports.mapLegacyStockMovementToPrisma = exports.mapLegacyMainStockRecordToPrisma = exports.mapLegacySiteRecordToPrisma = exports.mapLegacyInvoiceToPrisma = exports.mapLegacyQuotationToPrisma = exports.mapLegacyPurchaseReturnToPrisma = exports.mapLegacyDeliveryNoteToPrisma = exports.mapLegacyPurchaseOrderToPrisma = exports.mapLegacyClientToPrisma = exports.mapLegacySupplierToPrisma = exports.mapLegacyMaterialToPrisma = exports.mapLegacySiteToPrisma = exports.mapLegacyCompanyToPrisma = exports.mapLegacyNotificationPriorityToPrisma = exports.mapLegacyNotificationTypeToPrisma = exports.mapLegacyResourceTypeToPrisma = exports.mapLegacyActionTypeToPrisma = exports.mapLegacyMovementTypeToPrisma = exports.mapLegacyPurchaseOrderStatusToPrisma = exports.mapLegacyUserToPrisma = exports.mapLegacyRoleToPrisma = exports.toLegacyId = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const prisma_1 = __importDefault(require("../config/prisma"));
const database_1 = require("../config/database");
function toLegacyId(value) {
    if (value == null) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'object' && typeof value.toString === 'function') {
        const stringValue = value.toString();
        return stringValue === '[object Object]' ? null : stringValue;
    }
    return String(value);
}
exports.toLegacyId = toLegacyId;
function mapLegacyRoleToPrisma(role) {
    switch (role) {
        case 'main_manager':
            return 'MAIN_MANAGER';
        case 'site_manager':
            return 'SITE_MANAGER';
        case 'accountant':
            return 'ACCOUNTANT';
        case 'manager':
            return 'MANAGER';
        default:
            return 'MANAGER';
    }
}
exports.mapLegacyRoleToPrisma = mapLegacyRoleToPrisma;
function mapLegacyUserToPrisma(legacyUser) {
    return {
        id: toLegacyId(legacyUser._id ?? legacyUser.id),
        name: legacyUser.name,
        email: legacyUser.email,
        password: legacyUser.password,
        role: mapLegacyRoleToPrisma(legacyUser.role),
        assignedSites: legacyUser.assignedSites?.map(toLegacyId).filter(Boolean) ?? [],
        companyId: legacyUser.company_id ?? legacyUser.companyId,
        isActive: legacyUser.isActive ?? true,
        profilePicture: legacyUser.profilePicture ?? null,
        phone: legacyUser.phone ?? null,
        department: legacyUser.department ?? null,
        jobTitle: legacyUser.jobTitle ?? null,
        bio: legacyUser.bio ?? null,
        location: legacyUser.location ?? null,
        createdAt: legacyUser.createdAt ?? new Date(),
        updatedAt: legacyUser.updatedAt ?? new Date(),
    };
}
exports.mapLegacyUserToPrisma = mapLegacyUserToPrisma;
function mapLegacyPurchaseOrderStatusToPrisma(status) {
    switch (status) {
        case 'draft':
            return 'DRAFT';
        case 'sent':
            return 'SENT';
        case 'partial':
            return 'PARTIAL';
        case 'received':
            return 'RECEIVED';
        case 'completed':
            return 'COMPLETED';
        case 'cancelled':
            return 'CANCELLED';
        default:
            return 'DRAFT';
    }
}
exports.mapLegacyPurchaseOrderStatusToPrisma = mapLegacyPurchaseOrderStatusToPrisma;
function mapLegacyMovementTypeToPrisma(type) {
    switch (type?.toLowerCase()) {
        case 'received':
            return 'RECEIVED';
        case 'used':
            return 'USED';
        case 'adjustment':
            return 'ADJUSTMENT';
        default:
            return 'RECEIVED';
    }
}
exports.mapLegacyMovementTypeToPrisma = mapLegacyMovementTypeToPrisma;
function mapLegacyActionTypeToPrisma(type) {
    switch (type?.toLowerCase()) {
        case 'create':
            return 'CREATE';
        case 'update':
            return 'UPDATE';
        case 'delete':
            return 'DELETE';
        case 'login':
            return 'LOGIN';
        case 'logout':
            return 'LOGOUT';
        case 'assign':
            return 'ASSIGN';
        case 'unassign':
            return 'UNASSIGN';
        case 'price_update':
        case 'priceupdate':
            return 'PRICE_UPDATE';
        case 'sync':
            return 'SYNC';
        case 'export':
            return 'EXPORT';
        case 'import':
            return 'IMPORT';
        case 'view':
            return 'VIEW';
        default:
            return 'OTHER';
    }
}
exports.mapLegacyActionTypeToPrisma = mapLegacyActionTypeToPrisma;
function mapLegacyResourceTypeToPrisma(type) {
    switch (type?.toLowerCase()) {
        case 'site':
            return 'SITE';
        case 'site_record':
        case 'siterecord':
            return 'SITE_RECORD';
        case 'main_stock':
        case 'mainstock':
            return 'MAIN_STOCK';
        case 'material':
            return 'MATERIAL';
        case 'user':
            return 'USER';
        case 'system':
            return 'SYSTEM';
        case 'company':
            return 'COMPANY';
        case 'purchase_order':
        case 'purchaseorder':
            return 'PURCHASE_ORDER';
        case 'quotation':
            return 'QUOTATION';
        case 'invoice':
            return 'INVOICE';
        case 'client':
            return 'CLIENT';
        default:
            return 'SYSTEM';
    }
}
exports.mapLegacyResourceTypeToPrisma = mapLegacyResourceTypeToPrisma;
function mapLegacyNotificationTypeToPrisma(type) {
    switch (type?.toUpperCase()) {
        case 'MATERIAL_RECEIVED':
        case 'MATERIAL_RECEIVED':
            return 'MATERIAL_RECEIVED';
        case 'MATERIAL_USED':
            return 'MATERIAL_USED';
        case 'MATERIAL_LOW_STOCK':
            return 'MATERIAL_LOW_STOCK';
        case 'SITE_CREATED':
            return 'SITE_CREATED';
        case 'SITE_UPDATED':
            return 'SITE_UPDATED';
        case 'PRICE_UPDATED':
            return 'PRICE_UPDATED';
        case 'RECORD_RECEIVED':
            return 'RECORD_RECEIVED';
        case 'SYSTEM':
            return 'SYSTEM';
        default:
            return 'SYSTEM';
    }
}
exports.mapLegacyNotificationTypeToPrisma = mapLegacyNotificationTypeToPrisma;
function mapLegacyNotificationPriorityToPrisma(priority) {
    switch (priority?.toUpperCase()) {
        case 'LOW':
            return 'LOW';
        case 'MEDIUM':
            return 'MEDIUM';
        case 'HIGH':
            return 'HIGH';
        default:
            return 'MEDIUM';
    }
}
exports.mapLegacyNotificationPriorityToPrisma = mapLegacyNotificationPriorityToPrisma;
function mapLegacyCompanyToPrisma(legacyCompany) {
    return {
        id: toLegacyId(legacyCompany._id ?? legacyCompany.id),
        name: legacyCompany.name,
        companyId: legacyCompany.companyId ?? legacyCompany.company_id,
        logo: legacyCompany.logo ?? null,
        signatureImage: legacyCompany.signatureImage ?? null,
        stampImage: legacyCompany.stampImage ?? null,
        footerImage: legacyCompany.footerImage ?? null,
        address: legacyCompany.address ?? null,
        phone: legacyCompany.phone ?? null,
        email: legacyCompany.email ?? null,
        website: legacyCompany.website ?? null,
        taxId: legacyCompany.taxId ?? legacyCompany.tax_id ?? null,
        industry: legacyCompany.industry ?? null,
        description: legacyCompany.description ?? null,
        createdAt: legacyCompany.createdAt ?? new Date(),
        updatedAt: legacyCompany.updatedAt ?? new Date(),
    };
}
exports.mapLegacyCompanyToPrisma = mapLegacyCompanyToPrisma;
function mapLegacySiteToPrisma(legacySite) {
    return {
        id: toLegacyId(legacySite._id ?? legacySite.id),
        name: legacySite.name,
        location: legacySite.location ?? null,
        description: legacySite.description ?? null,
        companyId: legacySite.company_id ?? legacySite.companyId,
        createdById: toLegacyId(legacySite.createdBy ?? legacySite.createdById),
        isActive: legacySite.isActive ?? true,
        createdAt: legacySite.createdAt ?? new Date(),
        updatedAt: legacySite.updatedAt ?? new Date(),
    };
}
exports.mapLegacySiteToPrisma = mapLegacySiteToPrisma;
function mapLegacyMaterialToPrisma(legacyMaterial) {
    return {
        id: toLegacyId(legacyMaterial._id ?? legacyMaterial.id),
        name: legacyMaterial.name,
        unit: legacyMaterial.unit,
        description: legacyMaterial.description ?? null,
        companyId: legacyMaterial.company_id ?? legacyMaterial.companyId,
        isActive: legacyMaterial.isActive ?? true,
        createdAt: legacyMaterial.createdAt ?? new Date(),
        updatedAt: legacyMaterial.updatedAt ?? new Date(),
    };
}
exports.mapLegacyMaterialToPrisma = mapLegacyMaterialToPrisma;
function mapLegacySupplierToPrisma(legacySupplier) {
    return {
        id: toLegacyId(legacySupplier._id ?? legacySupplier.id),
        name: legacySupplier.name,
        contactPerson: legacySupplier.contactPerson ?? null,
        email: legacySupplier.email ?? null,
        phone: legacySupplier.phone ?? null,
        address: legacySupplier.address ?? null,
        companyId: legacySupplier.company_id ?? legacySupplier.companyId,
        isActive: legacySupplier.isActive ?? true,
        createdAt: legacySupplier.createdAt ?? new Date(),
        updatedAt: legacySupplier.updatedAt ?? new Date(),
    };
}
exports.mapLegacySupplierToPrisma = mapLegacySupplierToPrisma;
function mapLegacyClientToPrisma(legacyClient) {
    return {
        id: toLegacyId(legacyClient._id ?? legacyClient.id),
        name: legacyClient.name,
        contactPerson: legacyClient.contactPerson ?? null,
        email: legacyClient.email ?? null,
        phone: legacyClient.phone ?? null,
        address: legacyClient.address ?? null,
        taxId: legacyClient.taxId ?? legacyClient.tax_id ?? null,
        notes: legacyClient.notes ?? null,
        companyId: legacyClient.company_id ?? legacyClient.companyId,
        isActive: legacyClient.isActive ?? true,
        createdAt: legacyClient.createdAt ?? new Date(),
        updatedAt: legacyClient.updatedAt ?? new Date(),
    };
}
exports.mapLegacyClientToPrisma = mapLegacyClientToPrisma;
function mapLegacyPurchaseOrderToPrisma(legacyPurchaseOrder) {
    return {
        id: toLegacyId(legacyPurchaseOrder._id ?? legacyPurchaseOrder.id),
        poNumber: legacyPurchaseOrder.poNumber,
        supplierName: legacyPurchaseOrder.supplier?.name ?? null,
        supplier: legacyPurchaseOrder.supplier ?? null,
        siteId: toLegacyId(legacyPurchaseOrder.site_id ?? legacyPurchaseOrder.siteId),
        status: mapLegacyPurchaseOrderStatusToPrisma(legacyPurchaseOrder.status),
        items: legacyPurchaseOrder.items ?? [],
        subTotal: legacyPurchaseOrder.subTotal ?? 0,
        taxRate: legacyPurchaseOrder.taxRate ?? 0,
        taxAmount: legacyPurchaseOrder.taxAmount ?? 0,
        totalAmount: legacyPurchaseOrder.totalAmount ?? 0,
        notes: legacyPurchaseOrder.notes ?? null,
        terms: legacyPurchaseOrder.terms ?? null,
        sentDate: legacyPurchaseOrder.sentDate ?? null,
        expectedDeliveryDate: legacyPurchaseOrder.expectedDeliveryDate ?? null,
        createdById: toLegacyId(legacyPurchaseOrder.createdBy ?? legacyPurchaseOrder.createdById),
        companyId: legacyPurchaseOrder.company_id ?? legacyPurchaseOrder.companyId,
        createdAt: legacyPurchaseOrder.createdAt ?? new Date(),
        updatedAt: legacyPurchaseOrder.updatedAt ?? new Date(),
    };
}
exports.mapLegacyPurchaseOrderToPrisma = mapLegacyPurchaseOrderToPrisma;
function mapLegacyDeliveryNoteToPrisma(legacyDeliveryNote) {
    return {
        id: toLegacyId(legacyDeliveryNote._id ?? legacyDeliveryNote.id),
        dnNumber: legacyDeliveryNote.dnNumber,
        poId: toLegacyId(legacyDeliveryNote.poId),
        poNumber: legacyDeliveryNote.poNumber,
        supplierName: legacyDeliveryNote.supplier?.name ?? null,
        supplier: legacyDeliveryNote.supplier ?? null,
        siteId: toLegacyId(legacyDeliveryNote.site_id),
        siteInfo: legacyDeliveryNote.site ?? null,
        items: legacyDeliveryNote.items ?? [],
        deliveryDate: legacyDeliveryNote.deliveryDate ?? new Date(),
        receivedBy: legacyDeliveryNote.receivedBy,
        receivedByName: legacyDeliveryNote.receivedByName ?? null,
        carrier: legacyDeliveryNote.carrier ?? null,
        trackingNumber: legacyDeliveryNote.trackingNumber ?? null,
        condition: legacyDeliveryNote.condition ?? 'good',
        notes: legacyDeliveryNote.notes ?? null,
        attachments: legacyDeliveryNote.attachments ?? [],
        subTotal: legacyDeliveryNote.subTotal ?? 0,
        taxRate: legacyDeliveryNote.taxRate ?? 0,
        taxAmount: legacyDeliveryNote.taxAmount ?? 0,
        totalAmount: legacyDeliveryNote.totalAmount ?? 0,
        createdById: toLegacyId(legacyDeliveryNote.createdBy ?? legacyDeliveryNote.createdById),
        companyId: legacyDeliveryNote.company_id ?? legacyDeliveryNote.companyId,
        createdAt: legacyDeliveryNote.createdAt ?? new Date(),
        updatedAt: legacyDeliveryNote.updatedAt ?? new Date(),
    };
}
exports.mapLegacyDeliveryNoteToPrisma = mapLegacyDeliveryNoteToPrisma;
function mapLegacyPurchaseReturnToPrisma(legacyReturn) {
    return {
        id: toLegacyId(legacyReturn._id ?? legacyReturn.id),
        returnNumber: legacyReturn.returnNumber,
        poId: legacyReturn.poId,
        poNumber: legacyReturn.poNumber,
        supplierName: legacyReturn.supplier?.name ?? null,
        supplier: legacyReturn.supplier ?? null,
        siteId: toLegacyId(legacyReturn.site_id),
        siteInfo: legacyReturn.site ?? null,
        items: legacyReturn.items ?? [],
        returnDate: legacyReturn.returnDate ?? new Date(),
        returnedBy: legacyReturn.returnedBy,
        returnedByName: legacyReturn.returnedByName ?? null,
        carrier: legacyReturn.carrier ?? null,
        trackingNumber: legacyReturn.trackingNumber ?? null,
        condition: legacyReturn.condition ?? 'good',
        refundStatus: legacyReturn.refundStatus ?? 'pending',
        refundAmount: legacyReturn.refundAmount ?? null,
        notes: legacyReturn.notes ?? null,
        attachments: legacyReturn.attachments ?? [],
        companyId: legacyReturn.company_id ?? legacyReturn.companyId,
        createdById: toLegacyId(legacyReturn.createdBy ?? legacyReturn.createdById),
        createdAt: legacyReturn.createdAt ?? new Date(),
        updatedAt: legacyReturn.updatedAt ?? new Date(),
    };
}
exports.mapLegacyPurchaseReturnToPrisma = mapLegacyPurchaseReturnToPrisma;
function mapLegacyQuotationToPrisma(legacyQuotation) {
    return {
        id: toLegacyId(legacyQuotation._id ?? legacyQuotation.id),
        qtNumber: legacyQuotation.qtNumber,
        clientId: toLegacyId(legacyQuotation.client_id ?? legacyQuotation.clientId),
        clientName: legacyQuotation.client?.name ?? legacyQuotation.clientName ?? null,
        client: legacyQuotation.client ?? null,
        supplierName: legacyQuotation.supplier?.name ?? legacyQuotation.supplierName ?? null,
        supplier: legacyQuotation.supplier ?? null,
        siteId: toLegacyId(legacyQuotation.site_id ?? legacyQuotation.siteId),
        status: (legacyQuotation.status ?? 'draft'),
        items: legacyQuotation.items ?? [],
        subTotal: legacyQuotation.subTotal ?? 0,
        taxRate: legacyQuotation.taxRate ?? 0,
        taxAmount: legacyQuotation.taxAmount ?? 0,
        totalAmount: legacyQuotation.totalAmount ?? 0,
        validUntil: legacyQuotation.validUntil ?? null,
        notes: legacyQuotation.notes ?? null,
        terms: legacyQuotation.terms ?? null,
        sentDate: legacyQuotation.sentDate ?? null,
        convertedToPOId: toLegacyId(legacyQuotation.convertedToPO),
        convertedToInvoiceId: toLegacyId(legacyQuotation.convertedToInvoice),
        createdById: toLegacyId(legacyQuotation.createdBy ?? legacyQuotation.createdById),
        companyId: legacyQuotation.company_id ?? legacyQuotation.companyId,
        createdAt: legacyQuotation.createdAt ?? new Date(),
        updatedAt: legacyQuotation.updatedAt ?? new Date(),
    };
}
exports.mapLegacyQuotationToPrisma = mapLegacyQuotationToPrisma;
function mapLegacyInvoiceToPrisma(legacyInvoice) {
    return {
        id: toLegacyId(legacyInvoice._id ?? legacyInvoice.id),
        invoiceNumber: legacyInvoice.invoiceNumber,
        quotationId: toLegacyId(legacyInvoice.quotation_id ?? legacyInvoice.quotationId),
        qtNumber: legacyInvoice.qtNumber ?? null,
        clientId: toLegacyId(legacyInvoice.client_id ?? legacyInvoice.clientId),
        clientName: legacyInvoice.client?.name ?? legacyInvoice.clientName ?? null,
        client: legacyInvoice.client ?? null,
        siteId: toLegacyId(legacyInvoice.site_id ?? legacyInvoice.siteId),
        status: (legacyInvoice.status ?? 'draft'),
        items: legacyInvoice.items ?? [],
        subTotal: legacyInvoice.subTotal ?? 0,
        taxRate: legacyInvoice.taxRate ?? 0,
        taxAmount: legacyInvoice.taxAmount ?? 0,
        totalAmount: legacyInvoice.totalAmount ?? 0,
        amountPaid: legacyInvoice.amountPaid ?? 0,
        balanceDue: legacyInvoice.balanceDue ?? 0,
        issueDate: legacyInvoice.issueDate ?? new Date(),
        dueDate: legacyInvoice.dueDate ?? null,
        notes: legacyInvoice.notes ?? null,
        terms: legacyInvoice.terms ?? null,
        sentDate: legacyInvoice.sentDate ?? null,
        paidDate: legacyInvoice.paidDate ?? null,
        createdById: toLegacyId(legacyInvoice.createdBy ?? legacyInvoice.createdById),
        companyId: legacyInvoice.company_id ?? legacyInvoice.companyId,
        createdAt: legacyInvoice.createdAt ?? new Date(),
        updatedAt: legacyInvoice.updatedAt ?? new Date(),
    };
}
exports.mapLegacyInvoiceToPrisma = mapLegacyInvoiceToPrisma;
function mapLegacySiteRecordToPrisma(legacyRecord) {
    return {
        id: toLegacyId(legacyRecord._id ?? legacyRecord.id),
        siteId: toLegacyId(legacyRecord.site_id),
        materialId: toLegacyId(legacyRecord.material_id),
        materialName: legacyRecord.materialName,
        quantityReceived: legacyRecord.quantityReceived ?? 0,
        quantityUsed: legacyRecord.quantityUsed ?? 0,
        date: legacyRecord.date ?? new Date(),
        notes: legacyRecord.notes ?? null,
        createdById: toLegacyId(legacyRecord.recordedBy),
        companyId: legacyRecord.company_id ?? legacyRecord.companyId,
        createdAt: legacyRecord.createdAt ?? new Date(),
        updatedAt: legacyRecord.updatedAt ?? new Date(),
    };
}
exports.mapLegacySiteRecordToPrisma = mapLegacySiteRecordToPrisma;
function mapLegacyMainStockRecordToPrisma(legacyRecord) {
    const source = String(legacyRecord.source ?? 'site').toUpperCase();
    const status = String(legacyRecord.status ?? 'pending_price').toUpperCase();
    return {
        id: toLegacyId(legacyRecord._id ?? legacyRecord.id),
        source: source,
        siteSource: legacyRecord.source === 'direct' ? 'direct' : toLegacyId(legacyRecord.site_id) ?? 'direct',
        materialName: legacyRecord.materialName ?? 'Unknown material',
        quantityReceived: legacyRecord.quantityReceived ?? 0,
        quantityUsed: legacyRecord.quantityUsed ?? 0,
        price: legacyRecord.price ?? null,
        totalValue: legacyRecord.totalValue ?? null,
        date: legacyRecord.date ?? new Date(),
        status: status,
        notes: legacyRecord.notes ?? null,
        isDirectEntry: legacyRecord.source === 'direct',
        sourceRecordId: toLegacyId(legacyRecord.siteRecord_id),
        createdById: toLegacyId(legacyRecord.recordedBy),
        siteId: toLegacyId(legacyRecord.site_id),
        materialId: toLegacyId(legacyRecord.material_id),
        companyId: legacyRecord.company_id ?? legacyRecord.companyId,
        createdAt: legacyRecord.createdAt ?? new Date(),
        updatedAt: legacyRecord.updatedAt ?? new Date(),
    };
}
exports.mapLegacyMainStockRecordToPrisma = mapLegacyMainStockRecordToPrisma;
function mapLegacyStockMovementToPrisma(legacyMovement) {
    return {
        id: toLegacyId(legacyMovement._id ?? legacyMovement.id),
        mainStockRecordId: toLegacyId(legacyMovement.mainStockRecord_id),
        siteId: toLegacyId(legacyMovement.site_id),
        materialId: toLegacyId(legacyMovement.material_id),
        movementType: mapLegacyMovementTypeToPrisma(legacyMovement.movementType),
        quantity: legacyMovement.quantity ?? 0,
        previousQuantityUsed: legacyMovement.previousQuantityUsed ?? 0,
        previousQuantityReceived: legacyMovement.previousQuantityReceived ?? 0,
        newQuantityUsed: legacyMovement.newQuantityUsed ?? 0,
        newQuantityReceived: legacyMovement.newQuantityReceived ?? 0,
        performedById: toLegacyId(legacyMovement.performedBy),
        companyId: legacyMovement.company_id ?? legacyMovement.companyId,
        date: legacyMovement.date ?? new Date(),
        notes: legacyMovement.notes ?? null,
        createdAt: legacyMovement.createdAt ?? new Date(),
    };
}
exports.mapLegacyStockMovementToPrisma = mapLegacyStockMovementToPrisma;
function mapLegacyActionLogToPrisma(legacyActionLog) {
    return {
        id: toLegacyId(legacyActionLog._id ?? legacyActionLog.id),
        userId: toLegacyId(legacyActionLog.userId),
        userName: legacyActionLog.userName ?? legacyActionLog.user?.name ?? null,
        userEmail: legacyActionLog.userEmail ?? legacyActionLog.user?.email ?? null,
        userRole: legacyActionLog.userRole ?? null,
        companyId: legacyActionLog.companyId ?? legacyActionLog.company_id ?? null,
        action: mapLegacyActionTypeToPrisma(legacyActionLog.action),
        resource: mapLegacyResourceTypeToPrisma(legacyActionLog.resource),
        resourceId: toLegacyId(legacyActionLog.resourceId),
        resourceName: legacyActionLog.resourceName ?? null,
        description: legacyActionLog.description ?? '',
        details: legacyActionLog.details ?? null,
        ipAddress: legacyActionLog.ipAddress ?? null,
        userAgent: legacyActionLog.userAgent ?? null,
        timestamp: legacyActionLog.timestamp ?? new Date(),
    };
}
exports.mapLegacyActionLogToPrisma = mapLegacyActionLogToPrisma;
function mapLegacyNotificationToPrisma(legacyNotification) {
    return {
        id: toLegacyId(legacyNotification._id ?? legacyNotification.id),
        userId: toLegacyId(legacyNotification.userId),
        type: mapLegacyNotificationTypeToPrisma(legacyNotification.type),
        title: legacyNotification.title ?? '',
        message: legacyNotification.message ?? '',
        priority: mapLegacyNotificationPriorityToPrisma(legacyNotification.priority),
        isRead: legacyNotification.isRead ?? false,
        data: legacyNotification.data ?? null,
        link: legacyNotification.link ?? null,
        createdAt: legacyNotification.createdAt ?? new Date(),
        updatedAt: legacyNotification.updatedAt ?? new Date(),
    };
}
exports.mapLegacyNotificationToPrisma = mapLegacyNotificationToPrisma;
const collections = [
    { name: 'companies', model: 'company', mapper: mapLegacyCompanyToPrisma },
    { name: 'sites', model: 'site', mapper: mapLegacySiteToPrisma },
    { name: 'materials', model: 'material', mapper: mapLegacyMaterialToPrisma },
    { name: 'suppliers', model: 'supplier', mapper: mapLegacySupplierToPrisma },
    { name: 'clients', model: 'client', mapper: mapLegacyClientToPrisma },
    { name: 'users', model: 'user', mapper: mapLegacyUserToPrisma },
    { name: 'purchaseorders', model: 'purchaseOrder', mapper: mapLegacyPurchaseOrderToPrisma },
    { name: 'deliverynotes', model: 'deliveryNote', mapper: mapLegacyDeliveryNoteToPrisma },
    { name: 'purchasereturns', model: 'purchaseReturn', mapper: mapLegacyPurchaseReturnToPrisma },
    { name: 'quotations', model: 'quotation', mapper: mapLegacyQuotationToPrisma },
    { name: 'invoices', model: 'invoice', mapper: mapLegacyInvoiceToPrisma },
    { name: 'siterecords', model: 'siteRecord', mapper: mapLegacySiteRecordToPrisma },
    { name: 'mainstockrecords', model: 'mainStockRecord', mapper: mapLegacyMainStockRecordToPrisma },
    { name: 'stockmovements', model: 'stockMovement', mapper: mapLegacyStockMovementToPrisma },
    { name: 'actionlogs', model: 'actionLog', mapper: mapLegacyActionLogToPrisma },
    { name: 'notifications', model: 'notification', mapper: mapLegacyNotificationToPrisma },
];
async function migrateSiteAssignments(mongoDb, dryRun) {
    const users = await mongoDb.collection('users').find({ assignedSites: { $exists: true, $ne: [] } }).toArray();
    console.log(`Found ${users.length} users with assigned sites`);
    for (const legacyUser of users) {
        const userId = toLegacyId(legacyUser._id ?? legacyUser.id);
        if (!userId)
            continue;
        const assignedSiteIds = Array.isArray(legacyUser.assignedSites)
            ? legacyUser.assignedSites.map(toLegacyId).filter(Boolean)
            : [];
        for (const siteId of assignedSiteIds) {
            if (!siteId)
                continue;
            if (dryRun) {
                console.log(`[dry-run] siteAssignment: user=${userId}, site=${siteId}`);
                continue;
            }
            const existing = await prisma_1.default.siteAssignment.findFirst({ where: { userId, siteId } });
            if (existing) {
                continue;
            }
            try {
                await prisma_1.default.siteAssignment.create({
                    data: {
                        userId,
                        siteId,
                    },
                });
            }
            catch (error) {
                console.error(`Failed to migrate site assignment for user ${userId} and site ${siteId}`, error);
            }
        }
    }
}
async function migrateLegacyData(options = {}) {
    const { dryRun = false } = options;
    await prisma_1.default.$connect();
    const mongoDb = await (0, database_1.connectDB)();
    console.log('Starting legacy data migration from MongoDB to PostgreSQL...');
    for (const collection of collections) {
        const documents = await mongoDb.collection(collection.name).find({}).toArray();
        console.log(`Found ${documents.length} documents in ${collection.name}`);
        for (const document of documents) {
            const payload = collection.mapper(document);
            if (!payload?.id) {
                console.warn(`Skipping ${collection.name} document with missing id`, document);
                continue;
            }
            if (dryRun) {
                console.log(`[dry-run] ${collection.name}: ${payload.id}`);
                continue;
            }
            try {
                await prisma_1.default[collection.model].upsert({
                    where: { id: payload.id },
                    update: payload,
                    create: payload,
                });
            }
            catch (error) {
                console.error(`Failed to migrate ${collection.name} ${payload.id}`, error);
            }
        }
    }
    await migrateSiteAssignments(mongoDb, dryRun);
    if (!dryRun) {
        console.log('\nVerification counts after migration:');
        for (const collection of collections) {
            try {
                const count = await prisma_1.default[collection.model].count();
                console.log(`  ${collection.model}: ${count}`);
            }
            catch (error) {
                console.warn(`Unable to count ${collection.model}`, error);
            }
        }
    }
    await (0, database_1.disconnectDB)();
    await prisma_1.default.$disconnect();
    console.log('Legacy data migration completed.');
}
exports.migrateLegacyData = migrateLegacyData;
if (require.main === module) {
    migrateLegacyData({ dryRun: process.argv.includes('--dry-run') }).catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
//# sourceMappingURL=legacyDataMigration.js.map