// src/app/api/rooms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/lib/prisma';
import { CrosswordGenerator } from '@/core/use-cases/crosswordGenerator';
import { z } from 'zod';

const CreateRoomSchema = z.object({
  name: z.string().min(1).max(100),
  hostName: z.string().min(1).max(50),
  capacity: z.number().int().min(2).max(500).default(65),
  config: z.object({
    timePerQuestion: z.number().default(30),
    basePoints: z.number().default(100),
    timeMultiplier: z.number().default(3),
    showLeaderboardAfterEach: z.boolean().default(true),
    allowHints: z.boolean().default(false),
  }).optional(),
  puzzles: z.array(z.object({
    word: z.string().min(1),
    question: z.string().min(1),
    hint: z.string().optional(),
    basePoints: z.number().optional(),
    timeLimit: z.number().optional(),
  })).min(1),
});

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = CreateRoomSchema.parse(body);

    // Generate crossword layout
    const generator = new CrosswordGenerator();
    const result = generator.generate(data.puzzles);

    if (result.placements.length === 0) {
      return NextResponse.json({ error: 'Failed to generate crossword layout' }, { status: 400 });
    }

    // Generate unique room code
    let code = generateCode();
    let exists = await prisma.room.findUnique({ where: { code } });
    while (exists) {
      code = generateCode();
      exists = await prisma.room.findUnique({ where: { code } });
    }

    const room = await prisma.room.create({
      data: {
        code,
        name: data.name,
        hostName: data.hostName,
        capacity: data.capacity,
        config: data.config ?? {
          timePerQuestion: 30,
          basePoints: 100,
          timeMultiplier: 3,
          showLeaderboardAfterEach: true,
          allowHints: false,
        },
        puzzles: {
          create: result.placements.map((p) => ({
            question: p.question,
            answer: p.word,
            hint: p.hint,
            clueNumber: p.clueNumber,
            orientation: p.orientation,
            row: p.row,
            col: p.col,
            length: p.length,
            basePoints: p.basePoints,
            timeLimit: p.timeLimit,
          })),
        },
      },
      include: { puzzles: { orderBy: { clueNumber: 'asc' } } },
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('[POST /api/rooms]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
