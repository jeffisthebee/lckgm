// src/engine/SeasonManager.js
import { createFSTBracket } from './BracketManager';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

// ─────────────────────────────────────────────────────────────
// META SHIFT (16.02, 16.03, ...)
// ─────────────────────────────────────────────────────────────
export const updateChampionMeta = (currentChamps) => {
    const probabilities = {
        1: { 1: 0.40, 2: 0.40, 3: 0.15, 4: 0.04, 5: 0.01 },
        2: { 1: 0.25, 2: 0.40, 3: 0.25, 4: 0.08, 5: 0.02 },
        3: { 1: 0.07, 2: 0.23, 3: 0.40, 4: 0.23, 5: 0.07 },
        4: { 1: 0.02, 2: 0.08, 3: 0.25, 4: 0.40, 5: 0.25 },
        5: { 1: 0.01, 2: 0.04, 3: 0.15, 4: 0.25, 5: 0.55 },
    };

    const getNewTier = (currentTier) => {
        const tierNum = parseInt(currentTier, 10) || 3;
        if (!probabilities[tierNum]) return tierNum;
        const rand = Math.random();
        let cumulative = 0;
        for (const t of [1, 2, 3, 4, 5]) {
            if (probabilities[tierNum][t] !== undefined) {
                cumulative += probabilities[tierNum][t];
                if (rand < cumulative) return t;
            }
        }
        return tierNum;
    };

    if (!Array.isArray(currentChamps)) return [];
    return currentChamps.map(champ => ({ ...champ, tier: getNewTier(champ.tier) }));
};

// ─────────────────────────────────────────────────────────────
// LCK SPLIT 1 PATCH CLOCK (16.04 → 16.07)
// ─────────────────────────────────────────────────────────────
// Match dates are stored like: "4.12 (일)".
// Boundaries per user request:
// - 16.04: from 4/1 (수) up to 4/14 (Mon-Thu/Fri- Sat) effectively before 4/15 (수)
// - 16.05: 4/15 (수) .. before 4/29 (수)
// - 16.06: 4/29 (수) .. before 5/13 (수)
// - 16.07: 5/13 (수) and after
export const parseMonthDayNumFromDateStr = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const [month, day] = dateStr.split(' ')[0].split('.').map(Number);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
    return month * 100 + day;
};

export const getLCKSplit1PatchVersionForDate = (dateStr) => {
    const num = parseMonthDayNumFromDateStr(dateStr);
    if (num == null) return null;

    // Split 1 starts at 4/1 in this project timeline.
    if (num < 401) return null;

    if (num < 415) return '16.04';
    if (num < 429) return '16.05';
    if (num < 513) return '16.06';
    if (num < 601) return '16.07';
    // Road to MSI patch (6/1 and beyond)
    return '16.08';
};

// ─────────────────────────────────────────────────────────────
// SUPER WEEK MATCH GENERATION
// ─────────────────────────────────────────────────────────────
export const generateSuperWeekMatches = (league) => {
    const existingSuperMatches = league.matches
        ? league.matches.filter(m => m.type === 'super')
        : [];
    if (existingSuperMatches.length > 0) return [];

    const baronDraftOrder = league.groups?.baron || [];
    const elderDraftOrder = league.groups?.elder || [];
    const days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)'];

    let pairs = [];
    for (let i = 0; i < 5; i++) {
        if (baronDraftOrder[i] && elderDraftOrder[i]) {
            pairs.push({ t1: baronDraftOrder[i], t2: elderDraftOrder[i] });
        }
    }
    pairs.sort(() => Math.random() - 0.5);

    return pairs.map((pair, idx) => ({
        id: Date.now() + idx + 5000,
        t1: pair.t1,
        t2: pair.t2,
        date: days[idx] || '2.1 (일)',
        time: '17:00',
        type: 'super',
        format: 'BO5',
        status: 'pending',
    }));
};

// ─────────────────────────────────────────────────────────────
// FST TOURNAMENT INITIALIZATION
// ─────────────────────────────────────────────────────────────

// Grand-final match IDs per foreign league (from scheduleLogic.js)
const FOREIGN_FINAL_IDS = {
    LPL:   'lpl_po14',
    LEC:   'lec_po_final',
    LCS:   'lcs_po8',
    LCP:   'lcp_po8',
    CBLOL: 'cblol_po10',
};

const getForeignFinalMatch = (lgName, foreignMatches) => {
    const matches = foreignMatches?.[lgName] || [];
    const namedId = FOREIGN_FINAL_IDS[lgName];
    if (namedId) return matches.find(m => m.id === namedId) || null;
    // Fallback: find by type + highest round number
    const playoffMatches = matches.filter(m => m.type === 'playoff' && m.status === 'finished');
    if (playoffMatches.length === 0) return null;
    const maxRound = Math.max(...playoffMatches.map(m => m.round || 0));
    return playoffMatches.find(m => m.round === maxRound) || null;
};

const resolveTeamFromName = (nameOrId, lgTeams) => {
    if (!nameOrId) return null;
    const s = String(nameOrId).trim().toUpperCase();
    return lgTeams.find(
        t => t.name?.toUpperCase() === s ||
             t.fullName?.toUpperCase() === s ||
             String(t.id)?.toUpperCase() === s
    ) || null;
};

const getWinnerAndRunnerUp = (finalMatch, lgTeams) => {
    if (!finalMatch || finalMatch.status !== 'finished' || !finalMatch.result?.winner) {
        return { winner: null, runnerUp: null };
    }
    const winnerName = finalMatch.result.winner;
    const winner     = resolveTeamFromName(winnerName, lgTeams);

    // Resolve both team tokens to team objects first (handles both name and ID storage)
    const t1Team = resolveTeamFromName(finalMatch.t1, lgTeams);
    const t2Team = resolveTeamFromName(finalMatch.t2, lgTeams);

    // The runner-up is whichever resolved team is NOT the winner
    let runnerUp = null;
    if (winner && t1Team && t2Team) {
        runnerUp = t1Team.name === winner.name ? t2Team : t1Team;
    } else if (winner && t1Team) {
        runnerUp = t1Team.name !== winner.name ? t1Team : null;
    } else if (winner && t2Team) {
        runnerUp = t2Team.name !== winner.name ? t2Team : null;
    }

    return { winner, runnerUp };
};

const makeFSTTeam = (teamObj, league, slot) => {
    if (!teamObj) return null;
    return {
        fstId:    `${league}_${slot}`,
        league,
        slot,
        name:     teamObj.name,
        fullName: teamObj.fullName || teamObj.name,
        colors:   teamObj.colors  || { primary: '#555', secondary: '#eee' },
        power:    teamObj.power   || 80,
    };
};

/**
 * initFSTTournament
 * ─────────────────────────────────────────────────────────────
 * Assembles the 8 FST participants and builds the initial bracket.
 *
 * Participants:
 *   LCK Champion + Runner-Up  (from league.history, set by auto-archive)
 *   LPL Champion + Runner-Up  (from league.foreignMatches.LPL)
 *   LEC Champion              (from league.foreignMatches.LEC)
 *   LCS Champion              (from league.foreignMatches.LCS)
 *   LCP Champion              (from league.foreignMatches.LCP)
 *   CBLOL Champion            (from league.foreignMatches.CBLOL)
 *
 * @param {Object} league  Full league state from Dashboard
 * @returns {Object|null}  Initial fst state or null if data is missing
 */
export const initFSTTournament = (league) => {

    // ── 1. Verify LCK season is over ─────────────────────────
    const lckFinal = league.matches?.find(
        m => m.type === 'playoff' && m.round === 5 && m.status === 'finished'
    );
    if (!lckFinal) {
        console.warn('[FST] LCK Grand Final not finished yet.');
        return null;
    }

    // ── 2. LCK teams from league.history (populated by auto-archive) ──
    const lckHistory = (league.history || [])
        .slice()
        .sort((a, b) => (b.year || 0) - (a.year || 0));
    const latestLCK = lckHistory[0];

    const lckChampObj  = latestLCK?.champion;
    const lckRunnerObj = latestLCK?.runnerUp || latestLCK?.finalStandings?.[1]?.team;

    if (!lckChampObj || !lckRunnerObj) {
        console.warn('[FST] LCK champion/runner-up not found in history. Make sure the season has been archived.');
        return null;
    }

    const fstLCK_C  = makeFSTTeam(lckChampObj,  'LCK', 'C');
    const fstLCK_RU = makeFSTTeam(lckRunnerObj, 'LCK', 'RU');

    // ── 3. Foreign league champions / runner-ups ─────────────
    const foreignMatches = league.foreignMatches || {};

    const getFST = (lgName, slot) => {
        const lgTeams    = FOREIGN_LEAGUES[lgName] || [];
        const finalMatch = getForeignFinalMatch(lgName, foreignMatches);
        if (!finalMatch) {
            console.warn(`[FST] No finished final found for ${lgName}`);
            return null;
        }
        const { winner, runnerUp } = getWinnerAndRunnerUp(finalMatch, lgTeams);
        const teamObj = slot === 'C' ? winner : runnerUp;
        if (!teamObj) {
            console.warn(`[FST] Could not resolve ${lgName} ${slot}`, finalMatch);
            return null;
        }
        return makeFSTTeam(teamObj, lgName, slot);
    };

    const fstLPL_C   = getFST('LPL',   'C');
    const fstLPL_RU  = getFST('LPL',   'RU');
    const fstLEC_C   = getFST('LEC',   'C');
    const fstLCS_C   = getFST('LCS',   'C');
    const fstLCP_C   = getFST('LCP',   'C');
    const fstCBLOL_C = getFST('CBLOL', 'C');

    // ── 4. Validate — fill missing with placeholders ─────────
    const SLOT_LABELS = ['LCK_C','LCK_RU','LPL_C','LPL_RU','LEC_C','LCS_C','LCP_C','CBLOL_C'];
    const allEight    = [fstLCK_C, fstLCK_RU, fstLPL_C, fstLPL_RU, fstLEC_C, fstLCS_C, fstLCP_C, fstCBLOL_C];

    const missing = allEight.map((t, i) => !t ? SLOT_LABELS[i] : null).filter(Boolean);
    if (missing.length > 0) {
        console.warn('[FST] Missing participants (using placeholders):', missing.join(', '));
    }

    const placeholder = (fstId) => ({
        fstId,
        league:   fstId.split('_')[0],
        slot:     fstId.split('_').slice(1).join('_'),
        name:     fstId,
        fullName: `${fstId} (TBD)`,
        colors:   { primary: '#607d8b', secondary: '#eceff1' },
        power:    75,
    });

    const filledEight = allEight.map((t, i) => t || placeholder(SLOT_LABELS[i]));

    // ── 5. Build bracket ──────────────────────────────────────
    return createFSTBracket(filledEight);
};