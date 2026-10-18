import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const existing = await prisma.unit.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const unit = await prisma.unit.update({
      where: { id },
      data: {
        unitNumber: body.unitNumber,
        address: body.address,
      },
    });
    return NextResponse.json(unit);
  } catch (error) {
    console.error('Failed to update unit:', error);
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
    const existing = await prisma.unit.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const propertyId = existing.propertyId;
    await prisma.unit.delete({ where: { id } });

    // Sync Property.units count
    const unitCount = await prisma.unit.count({ where: { propertyId } });
    await prisma.property.update({ where: { id: propertyId }, data: { units: unitCount } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete unit:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
