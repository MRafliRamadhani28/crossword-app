// src/app/api/players/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/infrastructure/lib/prisma';
import { z } from 'zod';

const AVATARS = ['🎯', '🚀', '⚡', '🔥', '💎', '🌟', '🎪', '🏆', '🦁', '🐯', '🦊', '🐺'];

const JoinSchema = z.object({
  name: z.string().min(1).max(30),
  roomCode: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, roomCode } = JoinSchema.parse(body);

    const room = await prisma.room.findUnique({
      where: { code: roomCode.toUpperCase() },
      include: { _count: { select: { players: { where: { isActive: true } } } } },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    if (room.status === 'FINISHED') {
      return NextResponse.json({ error: 'Game sudah selesai' }, { status: 400 });
    }

    if (room.status === 'PLAYING') {
      return NextResponse.json({ error: 'Game sedang berlangsung. Tidak bisa join saat ini.' }, { status: 400 });
    }

    if (room._count.players >= room.capacity) {
      return NextResponse.json({ error: 'Room is full' }, { status: 400 });
    }

    const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];

    const player = await prisma.player.create({
      data: {
        name,
        avatar,
        roomId: room.id,
      },
    });

    return NextResponse.json({ player, room: { id: room.id, code: room.code, name: room.name, status: room.status } }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 });
    }
    console.error('[POST /api/players]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
