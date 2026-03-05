// src/app/api/rooms/by-code/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  try {
    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        _count: { select: { players: true } },
        players: {
          select: { id: true, displayName: true, totalPoints: true, isOnline: true },
          orderBy: { totalPoints: 'desc' },
        },
        puzzles: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            layout: true,
            clues: true,
            wordCount: true,
          },
        },
      },
    });

    if (!room) return NextResponse.json({ error: 'Room tidak ditemukan' }, { status: 404 });

    return NextResponse.json({
      id: room.id,
      name: room.name,
      code: room.code,
      capacity: room.capacity,
      status: room.status,
      playerCount: room._count.players,
      players: room.players,
      puzzles: room.puzzles,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
