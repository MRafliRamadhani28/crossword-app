'use client';

import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-yellow-400 mb-4" style={{ fontFamily: 'Syne, sans-serif' }}>
          404
        </h1>
        <p className="text-zinc-400 mb-6">Page not found</p>
        <button
          onClick={() => router.push('/')}
          className="btn-primary px-6 py-3"
        >
          Kembali ke Home
        </button>
      </div>
    </main>
  );
}
