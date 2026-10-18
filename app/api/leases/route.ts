import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leases = await prisma.lease.findMany({
      where: {
        property: { userId },
      },
      include: {
        property: true,
        unit: true,
        tenant: true,
      },
    });
    return NextResponse.json(leases);
  } catch (error) {
    console.error('Failed to fetch leases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const validationError = validateFields([
      { field: 'propertyId', value: body.propertyId, type: 'string', required: true },
      { field: 'unitId', value: body.unitId, type: 'string', required: true },
      { field: 'tenantId', value: body.tenantId, type: 'string', required: true },
      { field: 'leaseStart', value: body.leaseStart, type: 'string', required: true },
      { field: 'leaseEnd', value: body.leaseEnd, type: 'string', required: true },
      { field: 'monthlyRent', value: body.monthlyRent, type: 'positiveNumber', required: true },
      { field: 'deposit', value: body.deposit, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    // Verify the property belongs to the user
    const property = await prisma.property.findUnique({
      where: { id: body.propertyId },
    });
    if (!property || property.userId !== userId) {
      return NextResponse.json({ error: 'Property not found or not owned by user' }, { status: 403 });
    }

    const lease = await prisma.lease.create({
      data: {
        propertyId: body.propertyId,
        unitId: body.unitId,
        tenantId: body.tenantId,
        unitAddress: body.unitAddress ?? '',
        leaseStart: body.leaseStart,
        leaseEnd: body.leaseEnd,
        monthlyRent: body.monthlyRent,
        deposit: body.deposit ?? 0,
        isCurrentTenant: body.isCurrentTenant ?? true,
        isRecurringRent: body.isRecurringRent ?? true,
        notes: body.notes ?? '',
      },
    });
    return NextResponse.json(lease, { status: 201 });
  } catch (error) {
    console.error('Failed to create lease:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
