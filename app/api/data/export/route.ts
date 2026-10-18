import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Fetch all user data in parallel
    const [
      settings,
      ownerInfo,
      properties,
      tenants,
      leases,
      income,
      expenses,
      maintenance,
      mileageRates,
      mileageLogs,
    ] = await Promise.all([
      prisma.userSettings.findUnique({ where: { userId } }),
      prisma.ownerInfo.findUnique({ where: { userId } }),
      prisma.property.findMany({ where: { userId }, include: { unitList: true } }),
      prisma.tenant.findMany({ where: { userId } }),
      prisma.lease.findMany({
        where: { property: { userId } },
        include: { property: true, unit: true, tenant: true },
      }),
      prisma.incomeRecord.findMany({
        where: { property: { userId } },
        include: { property: true, unit: true, tenant: true },
      }),
      prisma.expenseRecord.findMany({
        where: { property: { userId } },
        include: { property: true, unit: true },
      }),
      prisma.maintenanceTask.findMany({
        where: { property: { userId } },
        include: { property: true, unit: true },
      }),
      prisma.mileageRate.findMany({ where: { userId } }),
      prisma.mileageLog.findMany({
        where: { userId },
        include: { property: true },
      }),
    ]);

    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),

      settings: settings
        ? {
            currency: settings.currency,
            propertyTypes: settings.propertyTypes,
            incomeCategories: settings.incomeCategories,
            expenseCategories: settings.expenseCategories,
            paymentMethods: settings.paymentMethods,
            mileageUnit: settings.mileageUnit,
            sidebarModules: settings.sidebarModules,
          }
        : null,

      ownerInfo: ownerInfo
        ? {
            name: ownerInfo.name,
            company: ownerInfo.company,
            address: ownerInfo.address,
            phone: ownerInfo.phone,
            email: ownerInfo.email,
          }
        : null,

      properties: properties.map((p) => ({
        name: p.name,
        units: p.units,
        type: p.type,
        address: p.address,
      })),

      units: properties.flatMap((p) =>
        p.unitList.map((u) => ({
          _propertyRef: p.name,
          unitNumber: u.unitNumber,
          address: u.address,
        }))
      ),

      tenants: tenants.map((t) => ({
        name: t.name,
        phone: t.phone,
        email: t.email,
      })),

      leases: leases.map((l) => ({
        _propertyRef: l.property.name,
        _unitRef: l.unit.unitNumber,
        _tenantRef: l.tenant.name,
        unitAddress: l.unitAddress,
        leaseStart: l.leaseStart,
        leaseEnd: l.leaseEnd,
        monthlyRent: l.monthlyRent,
        deposit: l.deposit,
        isCurrentTenant: l.isCurrentTenant,
        isRecurringRent: l.isRecurringRent,
        notes: l.notes,
      })),

      income: income.map((r) => ({
        _propertyRef: r.property.name,
        _unitRef: r.unit.unitNumber,
        _tenantRef: r.tenant.name,
        category: r.category,
        rentDueDate: r.rentDueDate,
        rentAmount: r.rentAmount,
        additionalIncome: r.additionalIncome,
        paymentDate: r.paymentDate,
        amountPaid: r.amountPaid,
        paymentMethod: r.paymentMethod,
        notes: r.notes,
      })),

      expenses: expenses.map((e) => ({
        _propertyRef: e.property.name,
        _unitRef: e.unit?.unitNumber ?? null,
        appliesToEntireBuilding: e.appliesToEntireBuilding,
        date: e.date,
        category: e.category,
        amount: e.amount,
        additionalFees: e.additionalFees,
        notes: e.notes,
      })),

      maintenance: maintenance.map((m) => ({
        _propertyRef: m.property.name,
        _unitRef: m.unit?.unitNumber ?? null,
        appliesToEntireBuilding: m.appliesToEntireBuilding,
        dateReported: m.dateReported,
        description: m.description,
        priority: m.priority,
        category: m.category,
        contractor: m.contractor,
        estimatedCost: m.estimatedCost,
        actualCost: m.actualCost,
        paymentStatus: m.paymentStatus,
        completionDate: m.completionDate,
        status: m.status,
        notes: m.notes,
      })),

      mileageRates: mileageRates.map((r) => ({
        rate: r.rate,
        startDate: r.startDate,
        endDate: r.endDate,
      })),

      mileageLogs: mileageLogs.map((l) => ({
        _propertyRef: l.property.name,
        date: l.date,
        distance: l.distance,
        amount: l.amount,
        description: l.description,
      })),
    };

    const today = new Date().toISOString().split('T')[0];
    const json = JSON.stringify(exportData, null, 2);

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="rental-data-export-${today}.json"`,
      },
    });
  } catch (error) {
    console.error('Failed to export data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
