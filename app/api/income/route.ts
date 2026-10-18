import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { computeIncomeFields } from '@/lib/computeFields';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const records = await prisma.incomeRecord.findMany({
      where: {
        property: { userId },
      },
      include: {
        property: true,
        unit: true,
        tenant: true,
      },
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch income records:', error);
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
      { field: 'rentAmount', value: body.rentAmount, type: 'nonNegativeNumber' },
      { field: 'additionalIncome', value: body.additionalIncome, type: 'nonNegativeNumber' },
      { field: 'amountPaid', value: body.amountPaid, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    // Verify the property belongs to the user
    const property = await prisma.property.findUnique({
      where: { id: body.propertyId },
    });
    if (!property || property.userId !== userId) {
      return NextResponse.json({ error: 'Property not found or not owned by user' }, { status: 403 });
    }

    const derived = computeIncomeFields(body);

    const record = await prisma.incomeRecord.create({
      data: {
        propertyId: body.propertyId,
        unitId: body.unitId,
        tenantId: body.tenantId,
        category: body.category ?? '',
        rentDueDate: body.rentDueDate ?? '',
        rentAmount: body.rentAmount ?? 0,
        additionalIncome: body.additionalIncome ?? 0,
        totalDue: derived.totalDue,
        paymentDate: body.paymentDate ?? '',
        amountPaid: body.amountPaid ?? 0,
        outstandingBalance: derived.outstandingBalance,
        paymentStatus: derived.paymentStatus,
        delayDays: derived.delayDays,
        paymentMethod: body.paymentMethod ?? '',
        notes: body.notes ?? '',
        receiptUrl: body.receiptUrl ?? '',
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('Failed to create income record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
