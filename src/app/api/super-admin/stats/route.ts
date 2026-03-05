// src/app/api/super-admin/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
  const session = verifyToken(token);
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [totalUsers, totalRooms, activeRooms, totalPlayers] = await Promise.all([
    prisma.user.count({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } }),
    prisma.room.count(),
    prisma.room.count({ where: { status: 'ACTIVE' } }),
    prisma.player.count(),
  ]);

  return NextResponse.json({ totalUsers, totalRooms, activeRooms, totalPlayers });
}
