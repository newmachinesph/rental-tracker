import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const records = await prisma.expenseRecord.findMany({
      where: {
        property: { userId },
      },
      include: {
        property: true,
        unit: true,
      },
    });
    return NextResponse.json(records);
  } catch (error) {
    console.error('Failed to fetch expense records:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const validationError = validateFields([
      { field: 'date', value: body.date, type: 'string', required: true },
      { field: 'propertyId', value: body.propertyId, type: 'string', required: true },
      { field: 'amount', value: body.amount, type: 'nonNegativeNumber' },
      { field: 'additionalFees', value: body.additionalFees, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    // Verify the property belongs to the user
    const property = await prisma.property.findUnique({
      where: { id: body.propertyId },
    });
    if (!property || property.userId !== userId) {
      return NextResponse.json({ error: 'Property not found or not owned by user' }, { status: 403 });
    }

    const amount = body.amount ?? 0;
    const additionalFees = body.additionalFees ?? 0;
    const total = amount + additionalFees;

    const record = await prisma.expenseRecord.create({
      data: {
        date: body.date,
        propertyId: body.propertyId,
        appliesToEntireBuilding: body.appliesToEntireBuilding ?? false,
        unitId: body.appliesToEntireBuilding ? null : (body.unitId || null),
        category: body.category ?? '',
        amount,
        additionalFees,
        total,
        notes: body.notes ?? '',
      },
    });
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('Failed to create expense record:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
