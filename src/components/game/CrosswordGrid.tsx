'use client';

import { useMemo } from 'react';

interface Puzzle {
  id: string;
  clueNumber: number;
  orientation: 'ACROSS' | 'DOWN';
  row: number;
  col: number;
  length: number;
  isOpened: boolean;
  isRevealed: boolean;
  answer?: string;
  word?: string;
  question?: string;
  hint?: string;
  basePoints?: number;
  timeLimit?: number;
}

interface CrosswordGridProps {
  puzzles: Puzzle[];
  gridSize?: number;
  activePuzzleId?: string | null;
  revealedAnswers?: Record<string, string>;
  playerAnswers?: Record<string, { content: string; isCorrect: boolean }>;
  compact?: boolean;
}

interface Cell {
  letter: string | null;
  clueNumber?: number;
  isBlack: boolean;
  puzzleIds: string[];
  isActive: boolean;
  isRevealed: boolean;
  isCorrect: boolean;
}

export function CrosswordGrid({
  puzzles,
  gridSize = 20,
  activePuzzleId,
  revealedAnswers = {},
  playerAnswers = {},
  compact = false,
}: CrosswordGridProps) {
  console.log('[CrosswordGrid] Received puzzles:', puzzles.length, puzzles);
  
  const { grid, minRow, maxRow, minCol, maxCol } = useMemo(() => {
    console.log('[CrosswordGrid] Building grid with', puzzles.length, 'puzzles');
    
    const g: Cell[][] = Array.from({ length: gridSize }, () =>
      Array.from({ length: gridSize }, () => ({
        letter: null,
        isBlack: true,
        puzzleIds: [],
        isActive: false,
        isRevealed: false,
        isCorrect: false,
      }))
    );

    let minR = gridSize, maxR = 0, minC = gridSize, maxC = 0;

    for (const puzzle of puzzles) {
      console.log('[CrosswordGrid] Processing puzzle:', puzzle.word, 'at row:', puzzle.row, 'col:', puzzle.col);
      
      const dr = puzzle.orientation === 'DOWN' ? 1 : 0;
      const dc = puzzle.orientation === 'ACROSS' ? 1 : 0;

      const answer = revealedAnswers[puzzle.id] ?? puzzle.answer ?? '';
      const playerAnswer = playerAnswers[puzzle.id];
      const isActive = puzzle.id === activePuzzleId;
      const isRevealed = puzzle.isRevealed || !!revealedAnswers[puzzle.id];

      for (let i = 0; i < puzzle.length; i++) {
        const r = puzzle.row + dr * i;
        const c = puzzle.col + dc * i;

        if (r < 0 || c < 0 || r >= gridSize || c >= gridSize) continue;

        g[r][c].isBlack = false;
        g[r][c].puzzleIds.push(puzzle.id);

        if (isActive) g[r][c].isActive = true;
        if (isRevealed && answer[i]) g[r][c].letter = answer[i];

        if (playerAnswer?.isCorrect && playerAnswer.content[i]) {
          g[r][c].letter = playerAnswer.content[i];
          g[r][c].isCorrect = true;
        }

        if (i === 0 && !g[r][c].clueNumber) {
          g[r][c].clueNumber = puzzle.clueNumber;
        }

        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }

    return { grid: g, minRow: Math.max(0, minR - 1), maxRow: Math.min(gridSize - 1, maxR + 1), minCol: Math.max(0, minC - 1), maxCol: Math.min(gridSize - 1, maxC + 1) };
  }, [puzzles, gridSize, activePuzzleId, revealedAnswers, playerAnswers]);

  const cellSize = compact ? 28 : 36;
  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  if (rows <= 0 || cols <= 0 || puzzles.length === 0) {
    return <p className="text-zinc-500 text-center py-8">Grid kosong atau tidak valid</p>;
  }

  return (
    <div
      className="overflow-auto"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gap: '2px',
        width: 'fit-content',
        margin: '0 auto',
      }}
    >
      {Array.from({ length: rows }, (_, ri) =>
        Array.from({ length: cols }, (_, ci) => {
          const cell = grid[minRow + ri]?.[minCol + ci];
          if (!cell) return null;

          let cellClass = 'crossword-cell';
          if (cell.isBlack) cellClass += ' black';
          else if (cell.isCorrect) cellClass += ' correct';
          else if (cell.isActive) cellClass += ' active';

          return (
            <div
              key={`${ri}-${ci}`}
              className={cellClass}
              style={{
                width: cellSize,
                height: cellSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: compact ? '12px' : '14px',
                fontWeight: 700,
                fontFamily: 'Syne, sans-serif',
                position: 'relative',
                borderRadius: '3px',
              }}
            >
              {!cell.isBlack && cell.clueNumber && (
                <span className="cell-number">{cell.clueNumber}</span>
              )}
              {!cell.isBlack && cell.letter && (
                <span style={{ color: cell.isCorrect ? '#39FF14' : cell.isActive ? '#FFE500' : '#fff' }}>
                  {cell.letter}
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
