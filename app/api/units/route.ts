import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    const units = await prisma.unit.findMany({
      where: {
        ...(propertyId ? { propertyId } : {}),
        property: { userId },
      },
      include: { property: true },
    });
    return NextResponse.json(units);
  } catch (error) {
    console.error('Failed to fetch units:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    // Verify the property belongs to the user
    const property = await prisma.property.findUnique({
      where: { id: body.propertyId },
    });
    if (!property || property.userId !== userId) {
      return NextResponse.json({ error: 'Property not found or not owned by user' }, { status: 403 });
    }

    const unit = await prisma.unit.create({
      data: {
        propertyId: body.propertyId,
        unitNumber: body.unitNumber,
        address: body.address ?? '',
      },
    });

    // Sync Property.units count
    const unitCount = await prisma.unit.count({ where: { propertyId: body.propertyId } });
    await prisma.property.update({ where: { id: body.propertyId }, data: { units: unitCount } });

    return NextResponse.json(unit, { status: 201 });
  } catch (error) {
    console.error('Failed to create unit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
