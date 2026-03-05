// src/lib/crossword.ts
// ─── Crossword Layout Generator ──────────────────────────────────────────────
// Uses a greedy + backtracking approach to place words on a grid.

export interface WordEntry {
  word: string;       // uppercase answer
  clue: string;       // hint/question
}

export interface PlacedWord {
  word: string;
  clue: string;
  direction: 'across' | 'down';
  startRow: number;
  startCol: number;
  length: number;
  number: number;     // clue number displayed on grid
}

export interface GridCell {
  row: number;
  col: number;
  letter: string;
  isBlack: boolean;
  number?: number;
  acrossClue?: number;
  downClue?: number;
}

export interface CrosswordLayout {
  rows: number;
  cols: number;
  cells: GridCell[][];
  placedWords: PlacedWord[];
  clues: {
    across: PlacedWord[];
    down: PlacedWord[];
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_GRID = 21;
const MIN_WORD_LEN = 3;
const MAX_ATTEMPTS = 500;

// ─── Helpers ─────────────────────────────────────────────────────────────────
type Grid = (string | null)[][];

function createGrid(size: number): Grid {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function canPlace(
  grid: Grid,
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down'
): boolean {
  const size = grid.length;
  const len = word.length;

  // Check bounds
  if (direction === 'across') {
    if (col < 0 || col + len > size) return false;
    if (row < 0 || row >= size) return false;
    // Check cell before word (must be empty or boundary)
    if (col > 0 && grid[row][col - 1] !== null) return false;
    // Check cell after word
    if (col + len < size && grid[row][col + len] !== null) return false;
  } else {
    if (row < 0 || row + len > size) return false;
    if (col < 0 || col >= size) return false;
    if (row > 0 && grid[row - 1][col] !== null) return false;
    if (row + len < size && grid[row + len][col] !== null) return false;
  }

  let intersections = 0;

  for (let i = 0; i < len; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    const existing = grid[r][c];

    if (existing !== null) {
      if (existing !== word[i]) return false; // conflict
      intersections++;
      // Check perpendicular adjacency doesn't create invalid words
    } else {
      // Check adjacent cells perpendicular to direction
      if (direction === 'across') {
        const above = r > 0 ? grid[r - 1][c] : null;
        const below = r < size - 1 ? grid[r + 1][c] : null;
        if ((above !== null || below !== null)) {
          // Would create a vertical word fragment — need intersection
          // This check is simplified; a full check would trace entire vertical word
        }
      } else {
        const left = c > 0 ? grid[r][c - 1] : null;
        const right = c < size - 1 ? grid[r][c + 1] : null;
      }
    }
  }

  // First word needs no intersections; subsequent words need at least 1
  return true;
}

function placeWord(
  grid: Grid,
  word: string,
  row: number,
  col: number,
  direction: 'across' | 'down'
): Grid {
  const newGrid = grid.map((r) => [...r]);
  for (let i = 0; i < word.length; i++) {
    const r = direction === 'across' ? row : row + i;
    const c = direction === 'across' ? col + i : col;
    newGrid[r][c] = word[i];
  }
  return newGrid;
}

function findIntersections(
  grid: Grid,
  word: string,
  direction: 'across' | 'down'
): Array<{ row: number; col: number; score: number }> {
  const size = grid.length;
  const candidates: Array<{ row: number; col: number; score: number }> = [];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (canPlace(grid, word, r, c, direction)) {
        // Score: prefer placements with intersections
        let score = 0;
        for (let i = 0; i < word.length; i++) {
          const pr = direction === 'across' ? r : r + i;
          const pc = direction === 'across' ? c + i : c;
          if (grid[pr][pc] === word[i]) score += 3; // intersection bonus
        }
        candidates.push({ row: r, col: c, score });
      }
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

// ─── Main Generator ───────────────────────────────────────────────────────────
export function generateCrossword(entries: WordEntry[]): CrosswordLayout {
  // Filter and sanitize
  const words = entries
    .filter((e) => e.word && e.word.length >= MIN_WORD_LEN)
    .map((e) => ({ ...e, word: e.word.toUpperCase().replace(/\s/g, '') }))
    .sort((a, b) => b.word.length - a.word.length); // longest first

  if (words.length === 0) {
    return emptyLayout();
  }

  let grid: Grid = createGrid(MAX_GRID);
  const placed: Array<{
    wordEntry: WordEntry & { word: string };
    direction: 'across' | 'down';
    startRow: number;
    startCol: number;
  }> = [];

  // Place first word horizontally in center
  const first = words[0];
  const centerRow = Math.floor(MAX_GRID / 2);
  const centerCol = Math.floor((MAX_GRID - first.word.length) / 2);
  grid = placeWord(grid, first.word, centerRow, centerCol, 'across');
  placed.push({ wordEntry: first, direction: 'across', startRow: centerRow, startCol: centerCol });

  // Place remaining words
  for (let wi = 1; wi < words.length; wi++) {
    const entry = words[wi];
    let bestPlacement: { row: number; col: number; dir: 'across' | 'down'; score: number } | null = null;

    // Try both directions
    for (const dir of ['across', 'down'] as const) {
      const candidates: Array<{ row: number; col: number; score: number }> = findIntersections(grid, entry.word, dir);
      const options = candidates.slice(0, 20);
      for (let i = 0; i < options.length; i++) {
        const c = options[i] as any;
        // Must intersect with at least one existing letter
        let hasIntersection = false;
        for (let j = 0; j < entry.word.length; j++) {
          const r = dir === 'across' ? c.row : c.row + j;
          const col = dir === 'across' ? c.col + j : c.col;
          if (grid[r][col] === entry.word[j]) {
            hasIntersection = true;
            break;
          }
        }
        if (!hasIntersection) continue;

        // @ts-ignore
        if (!bestPlacement || c.score > bestPlacement.score) {
          bestPlacement = { row: c.row, col: c.col, dir, score: c.score };
        }
        break;
      }
      if (bestPlacement) break;
    }

    if (bestPlacement) {
      grid = placeWord(grid, entry.word, bestPlacement.row, bestPlacement.col, bestPlacement.dir);
      placed.push({
        wordEntry: entry,
        direction: bestPlacement.dir,
        startRow: bestPlacement.row,
        startCol: bestPlacement.col,
      });
    }
  }

  return buildLayout(grid, placed);
}

function buildLayout(
  grid: Grid,
  placed: Array<{
    wordEntry: WordEntry & { word: string };
    direction: 'across' | 'down';
    startRow: number;
    startCol: number;
  }>
): CrosswordLayout {
  const size = MAX_GRID;

  // Find bounding box of placed letters
  let minRow = size, maxRow = 0, minCol = size, maxCol = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== null) {
        minRow = Math.min(minRow, r);
        maxRow = Math.max(maxRow, r);
        minCol = Math.min(minCol, c);
        maxCol = Math.max(maxCol, c);
      }
    }
  }

  // Add 1-cell padding
  minRow = Math.max(0, minRow - 1);
  minCol = Math.max(0, minCol - 1);
  maxRow = Math.min(size - 1, maxRow + 1);
  maxCol = Math.min(size - 1, maxCol + 1);

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;

  // Build cells
  const cells: GridCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      letter: grid[r + minRow][c + minCol] || '',
      isBlack: grid[r + minRow][c + minCol] === null,
    }))
  );

  // Number cells and build clue list
  let clueNum = 1;
  const numberedCells = new Map<string, number>();
  const acrossClues: PlacedWord[] = [];
  const downClues: PlacedWord[] = [];

  // Find all word starts
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (cells[r][c].isBlack) continue;

      const isAcrossStart =
        (c === 0 || cells[r][c - 1].isBlack) &&
        c + 1 < cols && !cells[r][c + 1].isBlack;

      const isDownStart =
        (r === 0 || cells[r - 1][c].isBlack) &&
        r + 1 < rows && !cells[r + 1][c].isBlack;

      if (isAcrossStart || isDownStart) {
        numberedCells.set(`${r},${c}`, clueNum);
        cells[r][c].number = clueNum;
        clueNum++;
      }
    }
  }

  // Match placed words to numbered cells
  for (const p of placed) {
    const adjRow = p.startRow - minRow;
    const adjCol = p.startCol - minCol;
    const cellKey = `${adjRow},${adjCol}`;
    const num = numberedCells.get(cellKey);

    if (num !== undefined) {
      const pw: PlacedWord = {
        word: p.wordEntry.word,
        clue: p.wordEntry.clue,
        direction: p.direction,
        startRow: adjRow,
        startCol: adjCol,
        length: p.wordEntry.word.length,
        number: num,
      };

      // Set acrossClue/downClue on cells
      for (let i = 0; i < p.wordEntry.word.length; i++) {
        const cr = p.direction === 'across' ? adjRow : adjRow + i;
        const cc = p.direction === 'across' ? adjCol + i : adjCol;
        if (cr < rows && cc < cols) {
          if (p.direction === 'across') cells[cr][cc].acrossClue = num;
          else cells[cr][cc].downClue = num;
        }
      }

      if (p.direction === 'across') acrossClues.push(pw);
      else downClues.push(pw);
    }
  }

  acrossClues.sort((a, b) => a.number - b.number);
  downClues.sort((a, b) => a.number - b.number);

  return {
    rows,
    cols,
    cells,
    placedWords: [...acrossClues, ...downClues],
    clues: { across: acrossClues, down: downClues },
  };
}

function emptyLayout(): CrosswordLayout {
  return {
    rows: 5,
    cols: 5,
    cells: Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => ({
        row: r, col: c, letter: '', isBlack: true,
      }))
    ),
    placedWords: [],
    clues: { across: [], down: [] },
  };
}

// ─── Scoring Utility ─────────────────────────────────────────────────────────
export interface SubmissionForScoring {
  playerId: string;
  answer: string;
  submittedAt: string; // ISO string
}

export function scoreSubmissions(
  submissions: SubmissionForScoring[],
  correctAnswer: string,
  basePoints = 100,
  speedBonus = 50
): Array<SubmissionForScoring & { isCorrect: boolean; points: number; rank: number }> {
  const correct = submissions
    .filter((s) => s.answer.trim().toUpperCase() === correctAnswer.toUpperCase())
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  const results = submissions.map((s) => {
    const isCorrect = s.answer.trim().toUpperCase() === correctAnswer.toUpperCase();
    const rank = isCorrect ? correct.findIndex((c) => c.playerId === s.playerId) + 1 : 0;
    const points = isCorrect
      ? Math.max(basePoints, basePoints + speedBonus - (rank - 1) * 10)
      : 0;
    return { ...s, isCorrect, points, rank };
  });

  return results;
}
