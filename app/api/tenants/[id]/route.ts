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
    const existing = await prisma.tenant.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email,
      },
    });
    return NextResponse.json(tenant);
  } catch (error) {
    console.error('Failed to update tenant:', error);
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
    const existing = await prisma.tenant.findUnique({ where: { id } });

    if (!existing) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.tenant.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete tenant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
