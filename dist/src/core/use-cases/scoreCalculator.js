"use strict";
// src/core/use-cases/scoreCalculator.ts
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateScore = calculateScore;
exports.calculateRanks = calculateRanks;
/**
 * Score = BasePoint + max(0, TimeRemaining × Multiplier)
 * Players who answer faster get higher time bonuses.
 */
function calculateScore(input) {
    var _a;
    if (!input.isCorrect) {
        return { baseScore: 0, timeBonus: 0, total: 0 };
    }
    var multiplier = (_a = input.timeMultiplier) !== null && _a !== void 0 ? _a : 3;
    var timeBonus = Math.max(0, Math.floor(input.timeRemaining * multiplier));
    var baseScore = input.basePoints;
    var total = baseScore + timeBonus;
    return { baseScore: baseScore, timeBonus: timeBonus, total: total };
}
/**
 * Update leaderboard ranks and detect position changes
 */
function calculateRanks(players) {
    var sorted = __spreadArray([], players, true).sort(function (a, b) { return b.points - a.points; });
    return sorted.map(function (player, index) {
        var _a;
        return ({
            id: player.id,
            points: player.points,
            rank: index + 1,
            previousRank: (_a = player.rank) !== null && _a !== void 0 ? _a : null,
        });
    });
}
