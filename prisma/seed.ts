import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Rental Tracker Seed Script (Admin Only) ---');
  console.log('Clearing existing data...');

  // Delete in reverse dependency order to respect foreign key constraints
  await prisma.mileageLog.deleteMany();
  await prisma.mileageRate.deleteMany();
  await prisma.maintenanceTask.deleteMany();
  await prisma.expenseRecord.deleteMany();
  await prisma.incomeRecord.deleteMany();
  await prisma.lease.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.property.deleteMany();
  await prisma.ownerInfo.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();

  console.log('All existing data cleared.');

  // ────────────────────────────────────────────────────────────────
  // 1. Admin User
  // ────────────────────────────────────────────────────────────────
  console.log('Creating admin user...');

  const adminPasswordHash = await bcrypt.hash('admin123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@gmail.com',
      passwordHash: adminPasswordHash,
      name: 'Juan Carlos Reyes',
      role: 'ADMIN',
    },
  });

  console.log(`  Created admin user: ${adminUser.email} (${adminUser.id})`);

  // ────────────────────────────────────────────────────────────────
  // 2. Admin UserSettings
  // ────────────────────────────────────────────────────────────────
  console.log('Creating admin settings...');

  const adminSettings = await prisma.userSettings.create({
    data: {
      userId: adminUser.id,
      currency: '₱',
      propertyTypes: ['Apartment', 'House', 'Cottage', 'Condo', 'Townhouse', 'Commercial'],
      incomeCategories: [
        'Rent',
        'Parking',
        'Laundry',
        'Pet Fee',
        'Late Fee',
        'Storage',
        'Other Income',
      ],
      expenseCategories: [
        'Maintenance',
        'Repairs',
        'Insurance',
        'Property Tax',
        'Utilities',
        'Management Fee',
        'Mortgage',
        'Landscaping',
        'Cleaning',
        'Legal Fees',
        'Advertising',
        'Other Expense',
      ],
      paymentMethods: [
        'Bank Transfer',
        'Cash',
        'Credit Card',
        'Check',
        'E-Transfer',
        'PayPal',
      ],
      mileageUnit: 'km' as const,
    },
  });

  console.log(`  Created admin settings: ${adminSettings.id}`);

  // ────────────────────────────────────────────────────────────────
  // 3. Admin OwnerInfo
  // ────────────────────────────────────────────────────────────────
  console.log('Creating admin owner info...');

  const ownerInfo = await prisma.ownerInfo.create({
    data: {
      userId: adminUser.id,
      name: 'Juan Carlos Reyes',
      company: 'JCR Property Management',
      address: 'Unit 1205, One Ayala Tower, Makati City',
      phone: '0917-888-1234',
      email: 'admin@gmail.com',
    },
  });

  console.log(`  Created owner info: ${ownerInfo.id}`);

  // ────────────────────────────────────────────────────────────────
  // Summary
  // ────────────────────────────────────────────────────────────────
  console.log('');
  console.log('--- Seed Complete ---');
  console.log(`  Users:              1 (admin only)`);
  console.log(`  User Settings:      1`);
  console.log(`  Owner Info:         1`);
  console.log('');
  console.log('Admin login:   admin@gmail.com / admin123');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
