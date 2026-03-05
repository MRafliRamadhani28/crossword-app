// src/app/api/sessions/[id]/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const session = verifyToken(token);
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { results } = body as {
      results: Array<{ playerId: string; answer: string; isCorrect: boolean; points: number; rank: number }>;
    };

    // Update session status
    await prisma.gameSession.update({
      where: { id: id },
      data: { status: 'VALIDATED', endTime: new Date() },
    });

    // Upsert submissions with scores
    for (const r of results) {
      await prisma.submission.upsert({
        where: { sessionId_playerId: { sessionId: id, playerId: r.playerId } },
        create: {
          sessionId: id,
          playerId: r.playerId,
          answer: r.answer,
          isCorrect: r.isCorrect,
          points: r.points,
          rank: r.rank || null,
        },
        update: {
          isCorrect: r.isCorrect,
          points: r.points,
          rank: r.rank || null,
        },
      });

      // Update player total points
      if (r.isCorrect && r.points > 0) {
        await prisma.player.update({
          where: { id: r.playerId },
          data: { totalPoints: { increment: r.points } },
        });
      }
    }

    return NextResponse.json({ success: true, processed: results.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
