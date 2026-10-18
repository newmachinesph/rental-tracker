import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { computeIncomeFields } from '@/lib/computeFields';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const record = await prisma.incomeRecord.findUnique({
      where: { id },
      include: { property: true, unit: true, tenant: true },
    });

    if (!record) {
      return NextResponse.json({ error: 'Income record not found' }, { status: 404 });
    }
    if (record.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('Failed to fetch income record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.incomeRecord.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Income record not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validationError = validateFields([
      { field: 'rentAmount', value: body.rentAmount, type: 'nonNegativeNumber' },
      { field: 'additionalIncome', value: body.additionalIncome, type: 'nonNegativeNumber' },
      { field: 'amountPaid', value: body.amountPaid, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    // Merge existing values with incoming updates for derived field computation
    const merged = {
      rentAmount: body.rentAmount ?? existing.rentAmount,
      additionalIncome: body.additionalIncome ?? existing.additionalIncome,
      amountPaid: body.amountPaid ?? existing.amountPaid,
      paymentDate: body.paymentDate ?? existing.paymentDate,
      rentDueDate: body.rentDueDate ?? existing.rentDueDate,
    };
    const derived = computeIncomeFields(merged);

    const record = await prisma.incomeRecord.update({
      where: { id },
      data: {
        propertyId: body.propertyId,
        unitId: body.unitId,
        tenantId: body.tenantId,
        category: body.category,
        rentDueDate: body.rentDueDate,
        rentAmount: body.rentAmount,
        additionalIncome: body.additionalIncome,
        totalDue: derived.totalDue,
        paymentDate: body.paymentDate,
        amountPaid: body.amountPaid,
        outstandingBalance: derived.outstandingBalance,
        paymentStatus: derived.paymentStatus,
        delayDays: derived.delayDays,
        paymentMethod: body.paymentMethod,
        notes: body.notes,
        receiptUrl: body.receiptUrl,
      },
    });
    return NextResponse.json(record);
  } catch (error) {
    console.error('Failed to update income record:', error);
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
    const existing = await prisma.incomeRecord.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Income record not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.incomeRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete income record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
