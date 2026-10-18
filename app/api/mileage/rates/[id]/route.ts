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
    const rate = await prisma.mileageRate.findUnique({
      where: { id },
    });

    if (!rate) {
      return NextResponse.json({ error: 'Mileage rate not found' }, { status: 404 });
    }
    if (rate.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(rate);
  } catch (error) {
    console.error('Failed to fetch mileage rate:', error);
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
    const existing = await prisma.mileageRate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mileage rate not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validationError = validateFields([
      { field: 'rate', value: body.rate, type: 'positiveNumber' },
    ]);
    if (validationError) return validationError;

    const rate = await prisma.mileageRate.update({
      where: { id },
      data: {
        rate: body.rate,
        startDate: body.startDate,
        endDate: body.endDate,
      },
    });
    return NextResponse.json(rate);
  } catch (error) {
    console.error('Failed to update mileage rate:', error);
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
    const existing = await prisma.mileageRate.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mileage rate not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.mileageRate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete mileage rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
