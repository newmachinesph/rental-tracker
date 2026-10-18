import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const properties = await prisma.property.findMany({
      where: { userId },
      include: { unitList: true },
    });
    return NextResponse.json(properties);
  } catch (error) {
    console.error('Failed to fetch properties:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const validationError = validateFields([
      { field: 'name', value: body.name, type: 'string', required: true },
      { field: 'type', value: body.type, type: 'string', required: true },
    ]);
    if (validationError) return validationError;

    const unitCount = body.units ?? 1;
    const property = await prisma.property.create({
      data: {
        userId,
        name: body.name,
        units: unitCount,
        type: body.type,
        address: body.address ?? '',
        unitList: {
          create: Array.from({ length: unitCount }, (_, i) => ({
            unitNumber: String(i + 1),
            address: '',
          })),
        },
      },
      include: { unitList: true },
    });
    return NextResponse.json(property, { status: 201 });
  } catch (error) {
    console.error('Failed to create property:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
