"use strict";
// src/infrastructure/lib/queue.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAnswerWorker = exports.answerQueue = void 0;
var bullmq_1 = require("bullmq");
var prisma_1 = require("./prisma");
var scoreCalculator_1 = require("../../core/use-cases/scoreCalculator");
var redis_1 = require("./redis");
var connection = {
    host: new URL((_a = process.env.REDIS_URL) !== null && _a !== void 0 ? _a : 'redis://localhost:6379').hostname,
    port: parseInt(new URL((_b = process.env.REDIS_URL) !== null && _b !== void 0 ? _b : 'redis://localhost:6379').port || '6379'),
};
// Queue for processing answers
exports.answerQueue = new bullmq_1.Queue('answer-processing', {
    connection: connection,
    defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 500 },
    },
});
// Worker that processes answers
var createAnswerWorker = function () {
    return new bullmq_1.Worker('answer-processing', function (job) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, playerId, puzzleId, content, submittedAt, roomId, puzzle, existing, isCorrect, timeElapsed, timeRemaining, room, config, _b, baseScore, timeBonus, total, answer;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = job.data, playerId = _a.playerId, puzzleId = _a.puzzleId, content = _a.content, submittedAt = _a.submittedAt, roomId = _a.roomId;
                    return [4 /*yield*/, prisma_1.prisma.puzzle.findUnique({ where: { id: puzzleId } })];
                case 1:
                    puzzle = _d.sent();
                    if (!puzzle || !puzzle.isOpened || puzzle.isRevealed) {
                        throw new Error('Puzzle not available');
                    }
                    return [4 /*yield*/, prisma_1.prisma.answer.findUnique({
                            where: { playerId_puzzleId: { playerId: playerId, puzzleId: puzzleId } },
                        })];
                case 2:
                    existing = _d.sent();
                    if (existing) {
                        return [2 /*return*/, {
                                isCorrect: existing.isCorrect,
                                points: existing.points,
                                timeBonus: existing.timeBonus,
                                playerId: playerId,
                                puzzleId: puzzleId,
                            }];
                    }
                    isCorrect = content.trim().toUpperCase() === puzzle.answer.trim().toUpperCase();
                    timeElapsed = puzzle.openedAt
                        ? (submittedAt - new Date(puzzle.openedAt).getTime()) / 1000
                        : puzzle.timeLimit;
                    timeRemaining = Math.max(0, puzzle.timeLimit - timeElapsed);
                    return [4 /*yield*/, prisma_1.prisma.room.findUnique({ where: { id: roomId } })];
                case 3:
                    room = _d.sent();
                    config = room === null || room === void 0 ? void 0 : room.config;
                    _b = (0, scoreCalculator_1.calculateScore)({
                        basePoints: puzzle.basePoints,
                        timeLimit: puzzle.timeLimit,
                        timeRemaining: timeRemaining,
                        timeMultiplier: (_c = config === null || config === void 0 ? void 0 : config.timeMultiplier) !== null && _c !== void 0 ? _c : 3,
                        isCorrect: isCorrect,
                    }), baseScore = _b.baseScore, timeBonus = _b.timeBonus, total = _b.total;
                    return [4 /*yield*/, prisma_1.prisma.answer.create({
                            data: {
                                content: content,
                                isCorrect: isCorrect,
                                points: isCorrect ? baseScore : 0,
                                timeBonus: isCorrect ? timeBonus : 0,
                                playerId: playerId,
                                puzzleId: puzzleId,
                            },
                        })];
                case 4:
                    answer = _d.sent();
                    if (!isCorrect) return [3 /*break*/, 6];
                    return [4 /*yield*/, prisma_1.prisma.player.update({
                            where: { id: playerId },
                            data: { points: { increment: total } },
                        })];
                case 5:
                    _d.sent();
                    _d.label = 6;
                case 6: 
                // Invalidate leaderboard cache
                return [4 /*yield*/, redis_1.cache.del("leaderboard:".concat(roomId))];
                case 7:
                    // Invalidate leaderboard cache
                    _d.sent();
                    return [2 /*return*/, { isCorrect: isCorrect, points: isCorrect ? total : 0, timeBonus: isCorrect ? timeBonus : 0, playerId: playerId, puzzleId: puzzleId }];
            }
        });
    }); }, { connection: connection, concurrency: 50 });
};
exports.createAnswerWorker = createAnswerWorker;
