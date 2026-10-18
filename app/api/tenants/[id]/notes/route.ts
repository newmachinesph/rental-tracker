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

  const notes = await prisma.tenantNote.findMany({
    where: { tenantId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(notes);
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
  const note = await prisma.tenantNote.create({
    data: { tenantId: id, content: body.content ?? '' },
  });
  return NextResponse.json(note);
}
