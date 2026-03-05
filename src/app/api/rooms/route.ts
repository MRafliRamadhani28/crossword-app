// src/app/api/rooms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, verifyToken } from '@/lib/auth';
import { nanoid } from 'nanoid';

// GET /api/rooms — List rooms for current admin
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const session = verifyToken(token);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const where =
      session.role === 'SUPER_ADMIN'
        ? {}
        : { adminId: session.userId };

    const rooms = await prisma.room.findMany({
      where,
      include: {
        _count: { select: { players: true } },
        admin: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      rooms: rooms.map((r) => ({
        id: r.id,
        name: r.name,
        code: r.code,
        capacity: r.capacity,
        status: r.status,
        playerCount: r._count.players,
        adminName: r.admin.name,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/rooms — Create room
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const session = verifyToken(token);
    if (!session || !['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, capacity = 20 } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Nama room harus diisi' }, { status: 400 });
    }

    // Generate unique room code
    let code = nanoid(6).toUpperCase();
    while (await prisma.room.findUnique({ where: { code } })) {
      code = nanoid(6).toUpperCase();
    }

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        code,
        capacity: Math.min(Math.max(parseInt(capacity), 2), 200),
        adminId: session.userId,
      },
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
