// src/app/api/rooms/[id]/puzzle/route.ts
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
    const { title, layout, clues, wordCount } = body;

    // Upsert puzzle (one puzzle per room for simplicity, or add multiple)
    const existing = await prisma.puzzle.findFirst({ where: { roomId: id }, orderBy: { createdAt: 'desc' } });

    const puzzle = existing
      ? await prisma.puzzle.update({
          where: { id: existing.id },
          data: { title, layout, clues, wordCount },
        })
      : await prisma.puzzle.create({
          data: { roomId: id, title, layout, clues, wordCount },
        });

    return NextResponse.json({ puzzle }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const puzzles = await prisma.puzzle.findMany({
    where: { roomId: id },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ puzzles });
}
