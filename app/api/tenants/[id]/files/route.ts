import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant || tenant.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const files = await prisma.tenantFile.findMany({
    where: { tenantId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(files);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant || tenant.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const file = await prisma.tenantFile.create({
    data: {
      tenantId: id,
      name: body.name ?? '',
      url: body.url ?? '',
      size: body.size ?? 0,
      type: body.type ?? '',
    },
  });
  return NextResponse.json(file);
}
