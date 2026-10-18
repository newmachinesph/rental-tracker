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
    const task = await prisma.maintenanceTask.findUnique({
      where: { id },
      include: { property: true, unit: true },
    });

    if (!task) {
      return NextResponse.json({ error: 'Maintenance task not found' }, { status: 404 });
    }
    if (task.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to fetch maintenance task:', error);
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
    const existing = await prisma.maintenanceTask.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Maintenance task not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();

    const validationError = validateFields([
      { field: 'estimatedCost', value: body.estimatedCost, type: 'nonNegativeNumber' },
      { field: 'actualCost', value: body.actualCost, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    const task = await prisma.maintenanceTask.update({
      where: { id },
      data: {
        propertyId: body.propertyId,
        appliesToEntireBuilding: body.appliesToEntireBuilding,
        unitId: body.appliesToEntireBuilding ? null : (body.unitId ?? existing.unitId),
        dateReported: body.dateReported,
        description: body.description,
        priority: body.priority,
        category: body.category,
        contractor: body.contractor,
        estimatedCost: body.estimatedCost,
        actualCost: body.actualCost,
        paymentStatus: body.paymentStatus,
        completionDate: body.completionDate,
        status: body.status,
        notes: body.notes,
      },
    });
    return NextResponse.json(task);
  } catch (error) {
    console.error('Failed to update maintenance task:', error);
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
    const existing = await prisma.maintenanceTask.findUnique({
      where: { id },
      include: { property: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Maintenance task not found' }, { status: 404 });
    }
    if (existing.property.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.maintenanceTask.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete maintenance task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
