import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const userId = await getSession(request);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, fileId } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant || tenant.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.tenantFile.delete({ where: { id: fileId, tenantId: id } });
  return NextResponse.json({ success: true });
}
