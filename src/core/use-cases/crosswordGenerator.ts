// src/core/use-cases/crosswordGenerator.ts

import type { Orientation } from '../entities';

export interface WordEntry {
  word: string;
  question: string;
  hint?: string;
  basePoints?: number;
  timeLimit?: number;
}

export interface PlacedWord {
  word: string;
  question: string;
  hint?: string;
  clueNumber: number;
  orientation: Orientation;
  row: number;
  col: number;
  length: number;
  basePoints: number;
  timeLimit: number;
}

export interface GeneratorResult {
  placements: PlacedWord[];
  gridSize: number;
  grid: string[][];
}

const GRID_SIZE = 20;
const MAX_ATTEMPTS = 1000;

export class CrosswordGenerator {
  private grid: string[][];
  private size: number;

  constructor(size = GRID_SIZE) {
    this.size = size;
    this.grid = Array.from({ length: size }, () => Array(size).fill(''));
  }

  generate(entries: WordEntry[]): GeneratorResult {
    // Sort by length descending — longer words first for better placement
    const sorted = [...entries].sort((a, b) => b.word.length - a.word.length);
    const placements: PlacedWord[] = [];
    this.grid = Array.from({ length: this.size }, () => Array(this.size).fill(''));

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const word = entry.word.toUpperCase().replace(/\s/g, '');
      const placed = i === 0
        ? this.placeFirst(entry, word, placements.length + 1)
        : this.placeNext(entry, word, placements.length + 1, placements);

      if (placed) {
        placements.push(placed);
      }
    }

    return {
      placements,
      gridSize: this.size,
      grid: this.grid,
    };
  }

  private placeFirst(entry: WordEntry, word: string, clueNumber: number): PlacedWord | null {
    const row = Math.floor(this.size / 2);
    const col = Math.floor((this.size - word.length) / 2);

    if (this.canPlace(word, row, col, 'ACROSS')) {
      this.place(word, row, col, 'ACROSS');
      return this.buildPlaced(entry, word, clueNumber, row, col, 'ACROSS');
    }
    return null;
  }

  private placeNext(
    entry: WordEntry,
    word: string,
    clueNumber: number,
    existing: PlacedWord[]
  ): PlacedWord | null {
    let attempts = 0;

    for (const placed of existing) {
      for (let li = 0; li < placed.word.length; li++) {
        for (let wi = 0; wi < word.length; wi++) {
          if (placed.word[li] !== word[wi]) continue;

          const orientations: Orientation[] = placed.orientation === 'ACROSS' ? ['DOWN'] : ['ACROSS'];

          for (const orientation of orientations) {
            let row: number, col: number;

            if (orientation === 'DOWN') {
              row = placed.row - wi;
              col = placed.col + li;
            } else {
              row = placed.row + li;
              col = placed.col - wi;
            }

            if (
              row >= 0 && col >= 0 &&
              row + (orientation === 'DOWN' ? word.length : 1) <= this.size &&
              col + (orientation === 'ACROSS' ? word.length : 1) <= this.size &&
              this.canPlace(word, row, col, orientation)
            ) {
              this.place(word, row, col, orientation);
              return this.buildPlaced(entry, word, clueNumber, row, col, orientation);
            }

            attempts++;
            if (attempts > MAX_ATTEMPTS) return null;
          }
        }
      }
    }

    // Fallback: find an empty area
    return this.placeIsolated(entry, word, clueNumber);
  }

  private placeIsolated(entry: WordEntry, word: string, clueNumber: number): PlacedWord | null {
    const orientations: Orientation[] = ['ACROSS', 'DOWN'];

    for (const orientation of orientations) {
      for (let row = 0; row < this.size - 2; row++) {
        for (let col = 0; col < this.size - 2; col++) {
          if (this.canPlace(word, row, col, orientation)) {
            this.place(word, row, col, orientation);
            return this.buildPlaced(entry, word, clueNumber, row, col, orientation);
          }
        }
      }
    }

    return null;
  }

  private canPlace(word: string, row: number, col: number, orientation: Orientation): boolean {
    const dr = orientation === 'DOWN' ? 1 : 0;
    const dc = orientation === 'ACROSS' ? 1 : 0;

    // Check bounds
    const endRow = row + dr * (word.length - 1);
    const endCol = col + dc * (word.length - 1);
    if (endRow >= this.size || endCol >= this.size) return false;

    // Check before start
    if (row - dr >= 0 && col - dc >= 0) {
      if (this.grid[row - dr][col - dc] !== '') return false;
    }

    // Check after end
    if (endRow + dr < this.size && endCol + dc < this.size) {
      if (this.grid[endRow + dr][endCol + dc] !== '') return false;
    }

    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const current = this.grid[r][c];

      if (current === '') {
        // Check adjacent (perpendicular) cells don't form accidental words
        const pr = orientation === 'DOWN' ? r : r;
        const pc = orientation === 'ACROSS' ? c : c;

        if (orientation === 'ACROSS') {
          if ((r > 0 && this.grid[r - 1][c] !== '') ||
              (r < this.size - 1 && this.grid[r + 1][c] !== '')) {
            // Has perpendicular neighbor — would need to form a valid word
            // Simple check: reject unless it's an intersection
            return false;
          }
        } else {
          if ((c > 0 && this.grid[r][c - 1] !== '') ||
              (c < this.size - 1 && this.grid[r][c + 1] !== '')) {
            return false;
          }
        }
      } else if (current !== word[i]) {
        return false; // Conflict
      }
    }

    return true;
  }

  private place(word: string, row: number, col: number, orientation: Orientation): void {
    const dr = orientation === 'DOWN' ? 1 : 0;
    const dc = orientation === 'ACROSS' ? 1 : 0;

    for (let i = 0; i < word.length; i++) {
      this.grid[row + dr * i][col + dc * i] = word[i];
    }
  }

  private buildPlaced(
    entry: WordEntry,
    word: string,
    clueNumber: number,
    row: number,
    col: number,
    orientation: Orientation
  ): PlacedWord {
    return {
      word,
      question: entry.question,
      hint: entry.hint,
      clueNumber,
      orientation,
      row,
      col,
      length: word.length,
      basePoints: entry.basePoints ?? 100,
      timeLimit: entry.timeLimit ?? 30,
    };
  }
}
