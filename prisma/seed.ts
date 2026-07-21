import dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/config/prisma';
import { hashPassword } from '../src/utils/auth';

const COMPANY_ID = 'CTS';

async function seed() {
  await prisma.$connect();

  const company = await prisma.company.upsert({
    where: { companyId: COMPANY_ID },
    update: {
      name: 'Lilstock Test Company',
    },
    create: {
      name: 'Lilstock Test Company',
      companyId: COMPANY_ID,
    },
  });

  const passwordHash = await hashPassword('admin123');

  const user = await prisma.user.upsert({
    where: { email: 'admin@lilstock.com' },
    update: {
      name: 'Main Manager',
      role: 'MAIN_MANAGER',
      companyId: company.companyId,
      isActive: true,
      password: passwordHash,
    },
    create: {
      name: 'Main Manager',
      email: 'admin@lilstock.com',
      password: passwordHash,
      role: 'MAIN_MANAGER',
      companyId: company.companyId,
      isActive: true,
    },
  });

  const materials = [
    { name: 'Cement', unit: 'kg', description: 'Portland cement' },
    { name: 'Steel Rebar', unit: 'meters', description: 'Reinforcement bars' },
    { name: 'Bricks', unit: 'pcs', description: 'Standard bricks' },
    { name: 'Sand', unit: 'kg', description: 'Construction sand' },
  ];

  for (const material of materials) {
    const existingMaterial = await prisma.material.findFirst({
      where: { name: material.name, companyId: company.companyId },
    });

    if (!existingMaterial) {
      await prisma.material.create({
        data: {
          ...material,
          companyId: company.companyId,
        },
      });
    }
  }

  const sites = [
    {
      name: 'Site 1 - Downtown Construction',
      location: 'Downtown District',
      description: 'First construction site',
    },
    {
      name: 'Site 2 - Industrial Park',
      location: 'Industrial Zone',
      description: 'Second construction site',
    },
  ];

  let firstSiteId: string | null = null;

  for (const siteData of sites) {
    let site = await prisma.site.findFirst({
      where: { name: siteData.name, companyId: company.companyId },
    });

    if (!site) {
      site = await prisma.site.create({
        data: {
          ...siteData,
          companyId: company.companyId,
          createdById: user.id,
        },
      });
    } else {
      await prisma.site.update({
        where: { id: site.id },
        data: {
          location: siteData.location,
          description: siteData.description,
        },
      });
    }

    if (!firstSiteId) {
      firstSiteId = site.id;
    }
  }

  if (firstSiteId) {
    await prisma.siteAssignment.upsert({
      where: { userId_siteId: { userId: user.id, siteId: firstSiteId } },
      update: {},
      create: {
        userId: user.id,
        siteId: firstSiteId,
      },
    });
  }

  console.log('Seed complete.');
  console.log('Admin credentials: admin@lilstock.com / admin123');
  console.log(`Company ID: ${company.companyId}`);

  await prisma.$disconnect();
}

seed().catch((error) => {
  console.error('Seed error:', error);
  process.exit(1);
});
