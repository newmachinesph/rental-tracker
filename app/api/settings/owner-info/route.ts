import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const ownerInfo = await prisma.ownerInfo.findUnique({
      where: { userId },
    });
    return NextResponse.json(ownerInfo ?? {});
  } catch (error) {
    console.error('Failed to fetch owner info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const ownerInfo = await prisma.ownerInfo.upsert({
      where: { userId },
      create: {
        userId,
        name: body.name ?? '',
        company: body.company ?? '',
        address: body.address ?? '',
        phone: body.phone ?? '',
        email: body.email ?? '',
      },
      update: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.company !== undefined && { company: body.company }),
        ...(body.address !== undefined && { address: body.address }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
      },
    });

    return NextResponse.json(ownerInfo);
  } catch (error) {
    console.error('Failed to update owner info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
