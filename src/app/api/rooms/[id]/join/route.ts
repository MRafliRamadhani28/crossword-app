// src/app/api/rooms/[id]/join/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const body = await request.json();
    const { displayName } = body;

    if (!displayName?.trim()) {
      return NextResponse.json({ error: 'Nama harus diisi' }, { status: 400 });
    }

    const room = await prisma.room.findUnique({
      where: { id: id },
      include: { _count: { select: { players: true } } },
    });

    if (!room) return NextResponse.json({ error: 'Room tidak ditemukan' }, { status: 404 });
    if (room.status === 'FINISHED') return NextResponse.json({ error: 'Permainan sudah selesai' }, { status: 400 });
    if (room._count.players >= room.capacity) return NextResponse.json({ error: 'Room penuh' }, { status: 400 });

    // Create ephemeral user for player (no auth required for players)
    const user = await prisma.user.create({
      data: {
        name: displayName.trim(),
        role: 'PLAYER',
      },
    });

    const player = await prisma.player.create({
      data: {
        userId: user.id,
        roomId: room.id,
        displayName: displayName.trim(),
      },
    });

    return NextResponse.json({
      playerId: player.id,
      userId: user.id,
      displayName: player.displayName,
      roomCode: room.code,
    }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
