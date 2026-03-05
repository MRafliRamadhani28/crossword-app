// src/components/CrosswordGrid.tsx
'use client';
import { useCallback } from 'react';
import type { GridCell, PlacedWord } from '@/lib/crossword';

interface CrosswordGridProps {
  cells: GridCell[][];
  activeClue?: PlacedWord | null;
  revealedAnswers?: Record<string, string>; // "row,col" → letter
  playerAnswers?: Record<string, string>;   // for player input mode
  mode: 'admin' | 'player' | 'view';
  locked?: boolean;
  onCellClick?: (cell: GridCell) => void;
  onCellInput?: (row: number, col: number, value: string) => void;
  validationResult?: Record<string, boolean>; // "row,col" → isCorrect
  liveAnswers?: Record<string, Record<string, string>>; // playerId → {cellKey → letter}
}

export default function CrosswordGrid({
  cells,
  activeClue,
  revealedAnswers = {},
  playerAnswers = {},
  mode,
  locked = false,
  onCellClick,
  onCellInput,
  validationResult,
  liveAnswers,
}: CrosswordGridProps) {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;

  // Determine which cells belong to the active clue
  const activeClueKeys = new Set<string>();
  if (activeClue) {
    for (let i = 0; i < activeClue.length; i++) {
      const r = activeClue.direction === 'across' ? activeClue.startRow : activeClue.startRow + i;
      const c = activeClue.direction === 'across' ? activeClue.startCol + i : activeClue.startCol;
      activeClueKeys.add(`${r},${c}`);
    }
  }

  const getCellClasses = useCallback((cell: GridCell) => {
    if (cell.isBlack) return 'cw-cell cw-cell--black';
    const key = `${cell.row},${cell.col}`;
    let cls = 'cw-cell cw-cell--white';

    if (mode === 'admin' && onCellClick) cls += ' cw-cell--interactive';

    if (activeClueKeys.has(key)) {
      cls += ' cw-cell--active';
    } else if (activeClue) {
      cls += ' cw-cell--highlight';
    }

    if (validationResult?.[key] === true) cls += ' cw-cell--correct';
    if (validationResult?.[key] === false) cls += ' cw-cell--incorrect';

    return cls;
  }, [activeClue, activeClueKeys, mode, onCellClick, validationResult]);

  const getDisplayLetter = (cell: GridCell) => {
    const key = `${cell.row},${cell.col}`;
    if (mode === 'player') return playerAnswers[key] || '';
    if (revealedAnswers[key]) return revealedAnswers[key];
    return '';
  };

  const isInActiveClue = (cell: GridCell) => activeClueKeys.has(`${cell.row},${cell.col}`);

  return (
    <div className="cw-grid-container">
      <div
        className="cw-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, var(--cell-size))`,
          gridTemplateRows: `repeat(${rows}, var(--cell-size))`,
        }}
      >
        {cells.flatMap((row) =>
          row.map((cell) => {
            const key = `${cell.row},${cell.col}`;
            const inActiveClue = isInActiveClue(cell);
            const isInteractive = mode === 'player' && inActiveClue && !locked;

            return (
              <div
                key={key}
                className={getCellClasses(cell)}
                onClick={() => !cell.isBlack && onCellClick?.(cell)}
                title={cell.isBlack ? '' : key}
              >
                {!cell.isBlack && (
                  <>
                    {cell.number && (
                      <span className="cw-cell__number">{cell.number}</span>
                    )}

                    {isInteractive ? (
                      <input
                        className="cw-input"
                        maxLength={1}
                        value={playerAnswers[key] || ''}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase().slice(-1);
                          onCellInput?.(cell.row, cell.col, val);
                        }}
                        disabled={locked}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    ) : (
                      <span className="cw-cell__letter">
                        {getDisplayLetter(cell)}
                      </span>
                    )}

                    {/* Live answer dots (admin view) */}
                    {mode === 'admin' && liveAnswers && (
                      <div style={{
                        position: 'absolute', bottom: 2, right: 2,
                        display: 'flex', gap: '1px', flexWrap: 'wrap',
                        maxWidth: '80%', justifyContent: 'flex-end',
                      }}>
                        {Object.entries(liveAnswers).map(([pid, answers]) =>
                          answers[key] ? (
                            <div
                              key={pid}
                              title={`Player ${pid}: ${answers[key]}`}
                              style={{
                                width: 4, height: 4, borderRadius: '50%',
                                background: 'var(--amber)',
                              }}
                            />
                          ) : null
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
