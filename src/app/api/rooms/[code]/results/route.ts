// src/app/api/rooms/[code]/results/route.ts
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
        players: {
          where: { isActive: true },
          orderBy: { points: 'desc' },
          include: {
            answers: {
              include: {
                puzzle: { select: { question: true, answer: true, clueNumber: true } },
              },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const leaderboard = room.players.map((p, i) => ({
      rank: i + 1,
      playerId: p.id,
      playerName: p.name,
      avatar: p.avatar,
      points: p.points,
      correctAnswers: p.answers.filter((a) => a.isCorrect).length,
      totalAnswers: p.answers.length,
      answers: p.answers,
    }));

    return NextResponse.json({ leaderboard });
  } catch (err) {
    console.error('[GET /api/rooms/:code/results]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
