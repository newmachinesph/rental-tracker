import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { validateFields } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const tenants = await prisma.tenant.findMany({
      where: { userId },
    });
    return NextResponse.json(tenants);
  } catch (error) {
    console.error('Failed to fetch tenants:', error);
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
    ]);
    if (validationError) return validationError;

    const tenant = await prisma.tenant.create({
      data: {
        userId,
        name: body.name,
        phone: body.phone ?? '',
        email: body.email ?? '',
      },
    });
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    console.error('Failed to create tenant:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
