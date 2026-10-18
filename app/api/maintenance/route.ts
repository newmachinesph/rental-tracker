import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tasks = await prisma.maintenanceTask.findMany({
      where: {
        property: { userId },
      },
      include: {
        property: true,
        unit: true,
      },
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch maintenance tasks:', error);
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
      { field: 'dateReported', value: body.dateReported, type: 'string', required: true },
      { field: 'estimatedCost', value: body.estimatedCost, type: 'nonNegativeNumber' },
      { field: 'actualCost', value: body.actualCost, type: 'nonNegativeNumber' },
    ]);
    if (validationError) return validationError;

    // Verify the property belongs to the user
    const property = await prisma.property.findUnique({
      where: { id: body.propertyId },
    });
    if (!property || property.userId !== userId) {
      return NextResponse.json({ error: 'Property not found or not owned by user' }, { status: 403 });
    }

    const task = await prisma.maintenanceTask.create({
      data: {
        propertyId: body.propertyId,
        appliesToEntireBuilding: body.appliesToEntireBuilding ?? false,
        unitId: body.appliesToEntireBuilding ? null : (body.unitId || null),
        dateReported: body.dateReported,
        description: body.description ?? '',
        priority: body.priority ?? 'Medium',
        category: body.category ?? '',
        contractor: body.contractor ?? '',
        estimatedCost: body.estimatedCost ?? 0,
        actualCost: body.actualCost ?? 0,
        paymentStatus: body.paymentStatus ?? 'Unpaid',
        completionDate: body.completionDate ?? '',
        status: body.status ?? 'Open',
        notes: body.notes ?? '',
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Failed to create maintenance task:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
