// src/app/api/sessions/route.ts — Create game session
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const session = verifyToken(token);
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { puzzleId, clue, duration = 60 } = body;

    // Close any open sessions for this puzzle
    await prisma.gameSession.updateMany({
      where: { puzzleId, status: { in: ['ACTIVE', 'PENDING'] } },
      data: { status: 'CLOSED', endTime: new Date() },
    });

    const gameSession = await prisma.gameSession.create({
      data: {
        puzzleId,
        clueIndex: clue.number,
        direction: clue.direction,
        duration,
        status: 'ACTIVE',
        startTime: new Date(),
      },
    });

    // Notify via global socket
    global._io?.to(`room:${body.roomCode}`);

    return NextResponse.json(gameSession, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
