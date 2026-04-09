'use client';

import { useEffect, useRef } from 'react';

interface ConfettiProps {
  active: boolean;
  count?: number;
}

const COLORS = ['#FFE500', '#FF2D78', '#00C8FF', '#39FF14', '#FF8C00', '#BF5AF2'];

export function ConfettiEffect({ active, count = 80 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();
  const particles = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    color: string; size: number; rotation: number; rotationSpeed: number; alpha: number;
  }>>([]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: -20,
      vx: (Math.random() - 0.5) * 6,
      vy: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    }));

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.current = particles.current.filter((p) => p.alpha > 0.05);

      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height * 0.7) p.alpha -= 0.02;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (particles.current.length > 0) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active, count]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}
