// src/app/api/rooms/[code]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        puzzles: {
          orderBy: { clueNumber: 'asc' },
          select: {
            id: true,
            clueNumber: true,
            orientation: true,
            row: true,
            col: true,
            length: true,
            isOpened: true,
            isRevealed: true,
            question: true,
            timeLimit: true,
            basePoints: true,
          },
        },
        players: {
          where: { isActive: true },
          orderBy: { points: 'desc' },
          select: { id: true, name: true, avatar: true, points: true, rank: true },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (err) {
    console.error('[GET /api/rooms/:code]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
