import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const logs = await prisma.mileageLog.findMany({
      where: { userId },
      include: {
        property: true,
      },
    });
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Failed to fetch mileage logs:', error);
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
      { field: 'date', value: body.date, type: 'string', required: true },
      { field: 'distance', value: body.distance, type: 'positiveNumber', required: true },
      { field: 'amount', value: body.amount, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    // Verify the property belongs to the user
    const property = await prisma.property.findUnique({
      where: { id: body.propertyId },
    });
    if (!property || property.userId !== userId) {
      return NextResponse.json({ error: 'Property not found or not owned by user' }, { status: 403 });
    }

    const log = await prisma.mileageLog.create({
      data: {
        userId,
        propertyId: body.propertyId,
        date: body.date,
        distance: body.distance,
        amount: body.amount ?? 0,
        description: body.description ?? '',
      },
    });
    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Failed to create mileage log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
