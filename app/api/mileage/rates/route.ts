import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rates = await prisma.mileageRate.findMany({
      where: { userId },
    });
    return NextResponse.json(rates);
  } catch (error) {
    console.error('Failed to fetch mileage rates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const validationError = validateFields([
      { field: 'rate', value: body.rate, type: 'positiveNumber', required: true },
      { field: 'startDate', value: body.startDate, type: 'string', required: true },
      { field: 'endDate', value: body.endDate, type: 'string', required: true },
    ]);
    if (validationError) return validationError;

    const rate = await prisma.mileageRate.create({
      data: {
        userId,
        rate: body.rate,
        startDate: body.startDate,
        endDate: body.endDate,
      },
    });
    return NextResponse.json(rate, { status: 201 });
  } catch (error) {
    console.error('Failed to create mileage rate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
