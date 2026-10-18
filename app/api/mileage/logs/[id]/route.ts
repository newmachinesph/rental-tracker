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
    const log = await prisma.mileageLog.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!log) {
      return NextResponse.json({ error: 'Mileage log not found' }, { status: 404 });
    }
    if (log.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(log);
  } catch (error) {
    console.error('Failed to fetch mileage log:', error);
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
    const existing = await prisma.mileageLog.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mileage log not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validationError = validateFields([
      { field: 'distance', value: body.distance, type: 'positiveNumber' },
      { field: 'amount', value: body.amount, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    const log = await prisma.mileageLog.update({
      where: { id },
      data: {
        propertyId: body.propertyId,
        date: body.date,
        distance: body.distance,
        amount: body.amount,
        description: body.description,
      },
    });
    return NextResponse.json(log);
  } catch (error) {
    console.error('Failed to update mileage log:', error);
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
    const existing = await prisma.mileageLog.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mileage log not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.mileageLog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete mileage log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
