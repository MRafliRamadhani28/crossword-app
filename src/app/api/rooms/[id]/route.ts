// src/app/api/rooms/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const session = verifyToken(token);

    const room = await prisma.room.findUnique({
      where: { id: id },
      include: {
        admin: { select: { id: true, name: true } },
        puzzles: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { gameSessions: { orderBy: { createdAt: 'desc' }, take: 5 } },
        },
        players: {
          include: { user: { select: { name: true } } },
          orderBy: { totalPoints: 'desc' },
        },
      },
    });

    if (!room) return NextResponse.json({ error: 'Room tidak ditemukan' }, { status: 404 });

    return NextResponse.json({
      ...room,
      players: room.players.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        totalPoints: p.totalPoints,
        isOnline: p.isOnline,
        joinedAt: p.joinedAt,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const session = verifyToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { status, name, capacity } = body;

    const room = await prisma.room.update({
      where: { id: id },
      data: {
        ...(status && { status }),
        ...(name && { name }),
        ...(capacity && { capacity }),
      },
    });

    return NextResponse.json({ room });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const session = verifyToken(token);
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.room.delete({ where: { id: id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
