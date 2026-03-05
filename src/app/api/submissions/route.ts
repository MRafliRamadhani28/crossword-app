// src/app/api/submissions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, playerId, answer } = body;

    if (!sessionId || !playerId || !answer?.trim()) {
      return NextResponse.json({ error: 'Data tidak lengkap' }, { status: 400 });
    }

    // Check session is active
    const session = await prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 400 });
    }

    // Upsert: only latest answer counts
    const submission = await prisma.submission.upsert({
      where: { sessionId_playerId: { sessionId, playerId } },
      create: {
        sessionId,
        playerId,
        answer: answer.trim().toUpperCase(),
        submittedAt: new Date(),
      },
      update: {
        answer: answer.trim().toUpperCase(),
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({ submission }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  if (!sessionId) return NextResponse.json({ error: 'sessionId required' }, { status: 400 });

  const submissions = await prisma.submission.findMany({
    where: { sessionId },
    include: { player: { select: { displayName: true } } },
    orderBy: { submittedAt: 'asc' },
  });

  return NextResponse.json({ submissions });
}
