import {
  mapLegacyUserToPrisma,
  mapLegacyCompanyToPrisma,
  mapLegacySiteToPrisma,
  mapLegacyMaterialToPrisma,
  mapLegacySupplierToPrisma,
  mapLegacyClientToPrisma,
  mapLegacyPurchaseOrderToPrisma,
  mapLegacyDeliveryNoteToPrisma,
  mapLegacyPurchaseReturnToPrisma,
  mapLegacyQuotationToPrisma,
  mapLegacyInvoiceToPrisma,
  mapLegacySiteRecordToPrisma,
  mapLegacyMainStockRecordToPrisma,
  mapLegacyStockMovementToPrisma,
  mapLegacyActionLogToPrisma,
  mapLegacyNotificationToPrisma,
  toLegacyId,
} from '../scripts/legacyDataMigration';

describe('legacy data migration mapping', () => {
  it('normalizes legacy ids from strings and ObjectId-like objects', () => {
    expect(toLegacyId('abc')).toBe('abc');
    expect(toLegacyId({ toString: () => 'abc' })).toBe('abc');
    expect(toLegacyId(null)).toBeNull();
    expect(toLegacyId(123)).toBe('123');
  });

  it('maps legacy companies to Prisma-compatible payloads', () => {
    const legacyCompany = {
      _id: { toString: () => 'company-001' },
      name: 'Acme Corp',
      company_id: 'company-001',
      email: 'info@acme.com',
      industry: 'construction',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    };

    expect(mapLegacyCompanyToPrisma(legacyCompany as any)).toEqual(
      expect.objectContaining({
        id: 'company-001',
        name: 'Acme Corp',
        companyId: 'company-001',
        email: 'info@acme.com',
        industry: 'construction',
      })
    );
  });

  it('maps legacy materials to Prisma-compatible payloads', () => {
    const legacyMaterial = {
      _id: { toString: () => 'material-001' },
      name: 'Cement',
      unit: 'bag',
      company_id: 'company-001',
      isActive: true,
    };

    expect(mapLegacyMaterialToPrisma(legacyMaterial as any)).toEqual(
      expect.objectContaining({
        id: 'material-001',
        name: 'Cement',
        unit: 'bag',
        companyId: 'company-001',
      })
    );
  });

  it('maps legacy clients to Prisma-compatible payloads', () => {
    const legacyClient = {
      _id: { toString: () => 'client-001' },
      name: 'Beta LLC',
      email: 'client@beta.com',
      company_id: 'company-001',
    };

    expect(mapLegacyClientToPrisma(legacyClient as any)).toEqual(
      expect.objectContaining({
        id: 'client-001',
        name: 'Beta LLC',
        email: 'client@beta.com',
        companyId: 'company-001',
      })
    );
  });

  it('maps legacy users to Prisma-compatible payloads', () => {
    const legacyUser = {
      _id: { toString: () => 'user-001' },
      name: 'Alice Johnson',
      email: 'alice@example.com',
      password: 'hashed-password',
      role: 'main_manager',
      company_id: 'company-001',
      isActive: true,
      assignedSites: [{ toString: () => 'site-001' }],
    };

    expect(mapLegacyUserToPrisma(legacyUser as any)).toEqual(
      expect.objectContaining({
        id: 'user-001',
        email: 'alice@example.com',
        role: 'MAIN_MANAGER',
        companyId: 'company-001',
        assignedSites: ['site-001'],
      })
    );
  });

  it('maps legacy purchase orders to Prisma-compatible payloads', () => {
    const legacyPurchaseOrder = {
      _id: { toString: () => 'po-001' },
      poNumber: 'PO-1001',
      supplier: { name: 'Acme Materials' },
      site_id: { toString: () => 'site-001' },
      status: 'received',
      items: [{ materialName: 'Cement', quantityOrdered: 20, unitPrice: 10, totalPrice: 200, unit: 'bag' }],
      createdBy: { toString: () => 'user-001' },
      company_id: 'company-001',
    };

    expect(mapLegacyPurchaseOrderToPrisma(legacyPurchaseOrder as any)).toEqual(
      expect.objectContaining({
        id: 'po-001',
        poNumber: 'PO-1001',
        supplierName: 'Acme Materials',
        status: 'RECEIVED',
        siteId: 'site-001',
        createdById: 'user-001',
        companyId: 'company-001',
      })
    );
  });

  it('maps legacy delivery notes to Prisma-compatible payloads', () => {
    const legacyDeliveryNote = {
      _id: { toString: () => 'dn-001' },
      dnNumber: 'DN-1001',
      poId: { toString: () => 'po-001' },
      poNumber: 'PO-1001',
      supplier: { name: 'Acme Materials' },
      site_id: { toString: () => 'site-001' },
      deliveryDate: new Date('2024-01-05T00:00:00.000Z'),
      receivedBy: 'John Doe',
      condition: 'good',
      subTotal: 100,
      taxRate: 5,
      taxAmount: 5,
      totalAmount: 105,
      createdBy: { toString: () => 'user-001' },
      company_id: 'company-001',
    };

    expect(mapLegacyDeliveryNoteToPrisma(legacyDeliveryNote as any)).toEqual(
      expect.objectContaining({
        id: 'dn-001',
        dnNumber: 'DN-1001',
        poId: 'po-001',
        supplierName: 'Acme Materials',
        siteId: 'site-001',
        receivedBy: 'John Doe',
        condition: 'good',
        totalAmount: 105,
      })
    );
  });

  it('maps legacy purchase returns to Prisma-compatible payloads', () => {
    const legacyReturn = {
      _id: { toString: () => 'pr-001' },
      returnNumber: 'PR-1001',
      poId: 'po-001',
      poNumber: 'PO-1001',
      supplier: { name: 'Acme Materials' },
      site_id: 'site-001',
      returnDate: new Date('2024-01-06T00:00:00.000Z'),
      returnedBy: 'Jane Doe',
      condition: 'damaged',
      refundStatus: 'processed',
      totalAmount: 90,
      company_id: 'company-001',
      createdBy: { toString: () => 'user-001' },
    };

    expect(mapLegacyPurchaseReturnToPrisma(legacyReturn as any)).toEqual(
      expect.objectContaining({
        id: 'pr-001',
        returnNumber: 'PR-1001',
        refundStatus: 'processed',
        returnedBy: 'Jane Doe',
        companyId: 'company-001',
      })
    );
  });

  it('maps legacy quotations to Prisma-compatible payloads', () => {
    const legacyQuotation = {
      _id: { toString: () => 'qt-001' },
      qtNumber: 'QT-1001',
      client_id: { toString: () => 'client-001' },
      client: { name: 'Acme Corp' },
      supplier: { name: 'Acme Materials' },
      site_id: { toString: () => 'site-001' },
      status: 'sent',
      items: [{ materialName: 'Cement', quantityRequested: 10, unitPrice: 10, totalPrice: 100, unit: 'bag' }],
      subTotal: 100,
      totalAmount: 105,
      createdBy: { toString: () => 'user-001' },
      company_id: 'company-001',
    };

    expect(mapLegacyQuotationToPrisma(legacyQuotation as any)).toEqual(
      expect.objectContaining({
        id: 'qt-001',
        clientId: 'client-001',
        clientName: 'Acme Corp',
        supplierName: 'Acme Materials',
        status: 'sent',
      })
    );
  });

  it('maps legacy site records to Prisma-compatible payloads', () => {
    const legacySiteRecord = {
      _id: { toString: () => 'sr-001' },
      site_id: { toString: () => 'site-001' },
      material_id: { toString: () => 'material-001' },
      materialName: 'Cement',
      quantityReceived: 50,
      quantityUsed: 10,
      date: new Date('2024-01-07T00:00:00.000Z'),
      recordedBy: { toString: () => 'user-001' },
      company_id: 'company-001',
    };

    expect(mapLegacySiteRecordToPrisma(legacySiteRecord as any)).toEqual(
      expect.objectContaining({
        id: 'sr-001',
        siteId: 'site-001',
        materialId: 'material-001',
        materialName: 'Cement',
        quantityReceived: 50,
      })
    );
  });

  it('maps legacy main stock records to Prisma-compatible payloads', () => {
    const legacyMainStock = {
      _id: { toString: () => 'msr-001' },
      source: 'site',
      site_id: { toString: () => 'site-001' },
      material_id: { toString: () => 'material-001' },
      quantityReceived: 50,
      quantityUsed: 10,
      status: 'pending_price',
      recordedBy: { toString: () => 'user-001' },
      company_id: 'company-001',
    };

    expect(mapLegacyMainStockRecordToPrisma(legacyMainStock as any)).toEqual(
      expect.objectContaining({
        id: 'msr-001',
        source: 'SITE',
        status: 'PENDING_PRICE',
        siteId: 'site-001',
        materialId: 'material-001',
        materialName: 'Unknown material',
        quantityReceived: 50,
      })
    );
  });

  it('maps legacy stock movements to Prisma-compatible payloads', () => {
    const legacyStockMovement = {
      _id: { toString: () => 'sm-001' },
      mainStockRecord_id: { toString: () => 'msr-001' },
      site_id: { toString: () => 'site-001' },
      material_id: { toString: () => 'material-001' },
      movementType: 'used',
      quantity: 5,
      previousQuantityUsed: 10,
      previousQuantityReceived: 50,
      newQuantityUsed: 15,
      newQuantityReceived: 50,
      performedBy: { toString: () => 'user-001' },
      company_id: 'company-001',
    };

    expect(mapLegacyStockMovementToPrisma(legacyStockMovement as any)).toEqual(
      expect.objectContaining({
        id: 'sm-001',
        mainStockRecordId: 'msr-001',
        movementType: 'USED',
        quantity: 5,
        performedById: 'user-001',
      })
    );
  });

  it('maps legacy action logs to Prisma-compatible payloads', () => {
    const legacyActionLog = {
      _id: { toString: () => 'al-001' },
      userId: { toString: () => 'user-001' },
      userName: 'Alice Johnson',
      userEmail: 'alice@example.com',
      userRole: 'MAIN_MANAGER',
      company_id: 'company-001',
      action: 'create',
      resource: 'purchase_order',
      description: 'Created a purchase order',
      timestamp: new Date('2024-01-08T00:00:00.000Z'),
    };

    expect(mapLegacyActionLogToPrisma(legacyActionLog as any)).toEqual(
      expect.objectContaining({
        id: 'al-001',
        userId: 'user-001',
        action: 'CREATE',
        resource: 'PURCHASE_ORDER',
        companyId: 'company-001',
      })
    );
  });

  it('maps legacy notifications to Prisma-compatible payloads', () => {
    const legacyNotification = {
      _id: { toString: () => 'notif-001' },
      userId: { toString: () => 'user-001' },
      type: 'MATERIAL_RECEIVED',
      title: 'Material received',
      message: '20 bags of cement were received',
      priority: 'HIGH',
      isRead: true,
      createdAt: new Date('2024-01-09T00:00:00.000Z'),
      updatedAt: new Date('2024-01-09T00:00:00.000Z'),
    };

    expect(mapLegacyNotificationToPrisma(legacyNotification as any)).toEqual(
      expect.objectContaining({
        id: 'notif-001',
        userId: 'user-001',
        type: 'MATERIAL_RECEIVED',
        priority: 'HIGH',
        isRead: true,
      })
    );
  });
});
