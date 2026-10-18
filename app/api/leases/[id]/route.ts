import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.lease.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validationError = validateFields([
      { field: 'monthlyRent', value: body.monthlyRent, type: 'positiveNumber' },
      { field: 'deposit', value: body.deposit, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    const lease = await prisma.lease.update({
      where: { id },
      data: {
        propertyId: body.propertyId,
        unitId: body.unitId,
        tenantId: body.tenantId,
        unitAddress: body.unitAddress,
        leaseStart: body.leaseStart,
        leaseEnd: body.leaseEnd,
        monthlyRent: body.monthlyRent,
        deposit: body.deposit,
        isCurrentTenant: body.isCurrentTenant,
        isRecurringRent: body.isRecurringRent,
        notes: body.notes,
      },
    });
    return NextResponse.json(lease);
  } catch (error) {
    console.error('Failed to update lease:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.lease.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Lease not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.lease.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete lease:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
