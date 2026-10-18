import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, noteId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant || tenant.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json();
  const note = await prisma.tenantNote.update({
    where: { id: noteId, tenantId: id },
    data: { content: body.content },
  });
  return NextResponse.json(note);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, noteId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant || tenant.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.tenantNote.delete({ where: { id: noteId, tenantId: id } });
  return NextResponse.json({ success: true });
}
