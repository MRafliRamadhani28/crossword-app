// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Super Admin
  const superAdminExists = await prisma.user.findUnique({ where: { email: 'superadmin@cw.live' } });
  if (!superAdminExists) {
    const superAdmin = await prisma.user.create({
      data: {
        email: 'superadmin@cw.live',
        name: 'Super Admin',
        password: await bcrypt.hash('superadmin123', 12),
        role: 'SUPER_ADMIN',
      },
    });
    console.log('✅ Super Admin created:', superAdmin.email);
  } else {
    console.log('⏭️  Super Admin already exists');
  }

  // Create Admin
  const adminExists = await prisma.user.findUnique({ where: { email: 'admin@cw.live' } });
  const admin = adminExists || await prisma.user.create({
    data: {
      email: 'admin@cw.live',
      name: 'Admin Demo',
      password: await bcrypt.hash('admin123', 12),
      role: 'ADMIN',
    },
  });
  if (!adminExists) console.log('✅ Admin created:', admin.email);
  else console.log('⏭️  Admin already exists');

  // Create demo room
  const roomExists = await prisma.room.findFirst({ where: { adminId: admin.id } });
  if (!roomExists) {
    const room = await prisma.room.create({
      data: {
        name: 'Demo Room - Geografi',
        code: 'DEMO01',
        capacity: 30,
        adminId: admin.id,
      },
    });
    console.log('✅ Demo room created:', room.code);

    // Create default global settings
    await prisma.globalSettings.createMany({
      data: [
        { key: 'defaultDuration', value: 60, description: 'Durasi countdown default (detik)' },
        { key: 'basePoints', value: 100, description: 'Poin dasar per jawaban benar' },
        { key: 'speedBonus', value: 50, description: 'Bonus kecepatan maksimal' },
      ],
      skipDuplicates: true,
    });
  }

  console.log('\n🎯 Seeding selesai!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Super Admin: superadmin@cw.live / superadmin123');
  console.log('Admin:       admin@cw.live / admin123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
