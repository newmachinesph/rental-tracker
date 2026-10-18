import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
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
    const record = await prisma.expenseRecord.findUnique({
      where: { id },
      include: { property: true, unit: true },
    });

    if (!record) {
      return NextResponse.json({ error: 'Expense record not found' }, { status: 404 });
    }
    if (record.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(record);
  } catch (error) {
    console.error('Failed to fetch expense record:', error);
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
    const existing = await prisma.expenseRecord.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Expense record not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validationError = validateFields([
      { field: 'amount', value: body.amount, type: 'nonNegativeNumber' },
      { field: 'additionalFees', value: body.additionalFees, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    // Recompute total from merged values
    const amount = body.amount ?? existing.amount;
    const additionalFees = body.additionalFees ?? existing.additionalFees;
    const total = amount + additionalFees;

    const record = await prisma.expenseRecord.update({
      where: { id },
      data: {
        date: body.date,
        propertyId: body.propertyId,
        appliesToEntireBuilding: body.appliesToEntireBuilding,
        unitId: body.appliesToEntireBuilding ? null : (body.unitId ?? existing.unitId),
        category: body.category,
        amount: body.amount,
        additionalFees: body.additionalFees,
        total,
        notes: body.notes,
      },
    });
    return NextResponse.json(record);
  } catch (error) {
    console.error('Failed to update expense record:', error);
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
    const existing = await prisma.expenseRecord.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Expense record not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.expenseRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete expense record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
