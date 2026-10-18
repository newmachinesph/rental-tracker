import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { computeIncomeFields, computeExpenseTotal } from '@/lib/computeFields';
import { NextRequest, NextResponse } from 'next/server';

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await request.json();

    // Basic structural validation
    if (!data || typeof data !== 'object' || data.version !== 1) {
      return NextResponse.json(
        { error: 'Invalid import file. Expected version 1 export format.' },
        { status: 400 }
      );
    }

    const requiredArrays = ['properties', 'units', 'tenants', 'leases', 'income', 'expenses', 'maintenance', 'mileageRates', 'mileageLogs'];
    for (const key of requiredArrays) {
      if (!Array.isArray(data[key])) {
        return NextResponse.json(
          { error: `Missing or invalid "${key}" array in import data.` },
          { status: 400 }
        );
      }
    }

    const counts = await prisma.$transaction(async (tx) => {
      // 1. Delete all existing user data
      // Properties cascade-delete: units, leases, income, expenses, maintenance, mileageLogs
      await tx.property.deleteMany({ where: { userId } });
      await tx.tenant.deleteMany({ where: { userId } });
      await tx.mileageRate.deleteMany({ where: { userId } });
      await tx.mileageLog.deleteMany({ where: { userId } });
      // ownerInfo is separate
      await tx.ownerInfo.deleteMany({ where: { userId } });

      // 2. Upsert settings
      if (data.settings) {
        await tx.userSettings.upsert({
          where: { userId },
          create: {
            userId,
            currency: data.settings.currency ?? '₱',
            propertyTypes: data.settings.propertyTypes ?? [],
            incomeCategories: data.settings.incomeCategories ?? [],
            expenseCategories: data.settings.expenseCategories ?? [],
            paymentMethods: data.settings.paymentMethods ?? [],
            mileageUnit: data.settings.mileageUnit ?? 'miles',
            sidebarModules: data.settings.sidebarModules ?? null,
          },
          update: {
            currency: data.settings.currency ?? '₱',
            propertyTypes: data.settings.propertyTypes ?? [],
            incomeCategories: data.settings.incomeCategories ?? [],
            expenseCategories: data.settings.expenseCategories ?? [],
            paymentMethods: data.settings.paymentMethods ?? [],
            mileageUnit: data.settings.mileageUnit ?? 'miles',
            sidebarModules: data.settings.sidebarModules ?? null,
          },
        });
      }

      // 3. Upsert ownerInfo
      if (data.ownerInfo) {
        await tx.ownerInfo.create({
          data: {
            userId,
            name: data.ownerInfo.name ?? '',
            company: data.ownerInfo.company ?? '',
            address: data.ownerInfo.address ?? '',
            phone: data.ownerInfo.phone ?? '',
            email: data.ownerInfo.email ?? '',
          },
        });
      }

      // 4. Create properties → build name→id map
      const propertyIds: Record<string, string> = {};
      for (const p of data.properties) {
        const created = await tx.property.create({
          data: {
            userId,
            name: p.name,
            units: p.units ?? 1,
            type: p.type ?? '',
            address: p.address ?? '',
          },
        });
        propertyIds[p.name] = created.id;
      }

      // 5. Create units → build "propertyName:unitNumber" → id map
      const unitIds: Record<string, string> = {};
      for (const u of data.units) {
        const propId = propertyIds[u._propertyRef];
        if (!propId) continue; // skip if property ref not found
        const created = await tx.unit.create({
          data: {
            propertyId: propId,
            unitNumber: u.unitNumber,
            address: u.address ?? '',
          },
        });
        unitIds[`${u._propertyRef}:${u.unitNumber}`] = created.id;
      }

      // 6. Create tenants → build name→id map
      const tenantIds: Record<string, string> = {};
      for (const t of data.tenants) {
        const created = await tx.tenant.create({
          data: {
            userId,
            name: t.name,
            phone: t.phone ?? '',
            email: t.email ?? '',
          },
        });
        tenantIds[t.name] = created.id;
      }

      // 7. Create leases
      let leaseCount = 0;
      for (const l of data.leases) {
        const propId = propertyIds[l._propertyRef];
        const unitId = unitIds[`${l._propertyRef}:${l._unitRef}`];
        const tenId = tenantIds[l._tenantRef];
        if (!propId || !unitId || !tenId) continue;

        await tx.lease.create({
          data: {
            propertyId: propId,
            unitId: unitId,
            tenantId: tenId,
            unitAddress: l.unitAddress ?? '',
            leaseStart: l.leaseStart,
            leaseEnd: l.leaseEnd,
            monthlyRent: l.monthlyRent,
            deposit: l.deposit ?? 0,
            isCurrentTenant: l.isCurrentTenant ?? true,
            isRecurringRent: l.isRecurringRent ?? true,
            notes: l.notes ?? '',
          },
        });
        leaseCount++;
      }

      // 8. Create income records (recompute derived fields)
      let incomeCount = 0;
      for (const r of data.income) {
        const propId = propertyIds[r._propertyRef];
        const unitId = unitIds[`${r._propertyRef}:${r._unitRef}`];
        const tenId = tenantIds[r._tenantRef];
        if (!propId || !unitId || !tenId) continue;

        const derived = computeIncomeFields({
          rentAmount: r.rentAmount,
          additionalIncome: r.additionalIncome,
          amountPaid: r.amountPaid,
          paymentDate: r.paymentDate,
          rentDueDate: r.rentDueDate,
        });

        await tx.incomeRecord.create({
          data: {
            propertyId: propId,
            unitId: unitId,
            tenantId: tenId,
            category: r.category ?? '',
            rentDueDate: r.rentDueDate ?? '',
            rentAmount: r.rentAmount ?? 0,
            additionalIncome: r.additionalIncome ?? 0,
            totalDue: derived.totalDue,
            paymentDate: r.paymentDate ?? '',
            amountPaid: r.amountPaid ?? 0,
            outstandingBalance: derived.outstandingBalance,
            paymentStatus: derived.paymentStatus,
            delayDays: derived.delayDays,
            paymentMethod: r.paymentMethod ?? '',
            notes: r.notes ?? '',
            receiptUrl: r.receiptUrl ?? '',
          },
        });
        incomeCount++;
      }

      // 9. Create expense records (recompute total)
      let expenseCount = 0;
      for (const e of data.expenses) {
        const propId = propertyIds[e._propertyRef];
        if (!propId) continue;

        const unitId = e._unitRef ? unitIds[`${e._propertyRef}:${e._unitRef}`] : null;
        const amount = e.amount ?? 0;
        const additionalFees = e.additionalFees ?? 0;

        await tx.expenseRecord.create({
          data: {
            date: e.date,
            propertyId: propId,
            appliesToEntireBuilding: e.appliesToEntireBuilding ?? false,
            unitId: e.appliesToEntireBuilding ? null : (unitId || null),
            category: e.category ?? '',
            amount,
            additionalFees,
            total: computeExpenseTotal(amount, additionalFees),
            notes: e.notes ?? '',
          },
        });
        expenseCount++;
      }

      // 10. Create maintenance tasks
      let maintenanceCount = 0;
      for (const m of data.maintenance) {
        const propId = propertyIds[m._propertyRef];
        if (!propId) continue;

        const unitId = m._unitRef ? unitIds[`${m._propertyRef}:${m._unitRef}`] : null;

        await tx.maintenanceTask.create({
          data: {
            propertyId: propId,
            appliesToEntireBuilding: m.appliesToEntireBuilding ?? false,
            unitId: m.appliesToEntireBuilding ? null : (unitId || null),
            dateReported: m.dateReported,
            description: m.description ?? '',
            priority: m.priority ?? 'Medium',
            category: m.category ?? '',
            contractor: m.contractor ?? '',
            estimatedCost: m.estimatedCost ?? 0,
            actualCost: m.actualCost ?? 0,
            paymentStatus: m.paymentStatus ?? 'Unpaid',
            completionDate: m.completionDate ?? '',
            status: m.status ?? 'Open',
            notes: m.notes ?? '',
          },
        });
        maintenanceCount++;
      }

      // 11. Create mileage rates
      for (const r of data.mileageRates) {
        await tx.mileageRate.create({
          data: {
            userId,
            rate: r.rate,
            startDate: r.startDate,
            endDate: r.endDate,
          },
        });
      }

      // 12. Create mileage logs
      let mileageLogCount = 0;
      for (const l of data.mileageLogs) {
        const propId = propertyIds[l._propertyRef];
        if (!propId) continue;

        await tx.mileageLog.create({
          data: {
            userId,
            propertyId: propId,
            date: l.date,
            distance: l.distance,
            amount: l.amount ?? 0,
            description: l.description ?? '',
          },
        });
        mileageLogCount++;
      }

      return {
        properties: data.properties.length,
        units: data.units.length,
        tenants: data.tenants.length,
        leases: leaseCount,
        income: incomeCount,
        expenses: expenseCount,
        maintenance: maintenanceCount,
        mileageRates: data.mileageRates.length,
        mileageLogs: mileageLogCount,
      };
    });

    return NextResponse.json({ success: true, counts });
  } catch (error) {
    console.error('Failed to import data:', error);
    return NextResponse.json({ error: 'Import failed. No data was changed.' }, { status: 500 });
  }
}
