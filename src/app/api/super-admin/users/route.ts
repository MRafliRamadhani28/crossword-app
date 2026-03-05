// src/app/api/super-admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken, hashPassword } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
  const session = verifyToken(token);
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { adminRooms: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '') || '';
  const session = verifyToken(token);
  if (!session || session.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { name, email, password, role = 'ADMIN' } = await request.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Semua field harus diisi' }, { status: 400 });
  }

  const hashed = await hashPassword(password);

  const user = await prisma.user.create({
    data: { name, email, password: hashed, role },
  });

  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } }, { status: 201 });
}
