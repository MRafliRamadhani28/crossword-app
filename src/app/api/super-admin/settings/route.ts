// src/app/api/super-admin/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
  const session = verifyToken(token);
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const settings = await prisma.globalSettings.findMany();
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
  const session = verifyToken(token);
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { defaultDuration, basePoints, speedBonus } = body;

  const updates = [
    { key: 'defaultDuration', value: defaultDuration },
    { key: 'basePoints', value: basePoints },
    { key: 'speedBonus', value: speedBonus },
  ];

  for (const u of updates) {
    await prisma.globalSettings.upsert({
      where: { key: u.key },
      update: { value: u.value },
      create: { key: u.key, value: u.value },
    });
  }

  return NextResponse.json({ success: true });
}
