// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { CrosswordGenerator } from '../src/core/use-cases/crosswordGenerator';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const entries = [
    { word: 'BANDUNG', question: 'Ibukota Jawa Barat', hint: 'Kota kembang', basePoints: 100, timeLimit: 30 },
    { word: 'ANGKLUNG', question: 'Alat musik bambu khas Jawa Barat', hint: 'UNESCO heritage', basePoints: 150, timeLimit: 30 },
    { word: 'SUNDA', question: 'Suku bangsa mayoritas di Jawa Barat', basePoints: 100, timeLimit: 25 },
    { word: 'GEDUNG', question: 'Bangunan tempat bekerja atau berkumpul', basePoints: 80, timeLimit: 20 },
    { word: 'BUNGA', question: 'Simbol kecantikan yang tumbuh di taman', basePoints: 80, timeLimit: 20 },
  ];

  const generator = new CrosswordGenerator();
  const result = generator.generate(entries);

  await prisma.room.upsert({
    where: { code: 'BDG001' },
    update: {},
    create: {
      code: 'BDG001',
      name: 'Teka-Teki Bandung',
      hostName: 'Rafli',
      capacity: 65,
      config: {
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
  });

  console.log('✅ Seed complete! Room code: BDG001');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
