// src/engine/BracketManager.js
import { teams } from '../data/teams';

// [NEW] Helper to compare dates correctly (e.g., "2.7" vs "2.11")
const compareDates = (dateA, dateB) => {
    if (!dateA || !dateB) return 0;
    
    // Split "2.7 (Sat)" -> "2.7" -> ["2", "7"]
    const [monthA, dayA] = dateA.split(' ')[0].split('.').map(Number);
    const [monthB, dayB] = dateB.split(' ')[0].split('.').map(Number);
    
    if (monthA !== monthB) return monthA - monthB;
    return dayA - dayB;
};

// This function takes the league data and calculates wins/losses for every team
export const computeStandings = (league) => {
    // 1. Initialize standings for all teams
    const newStandings = {};
    teams.forEach(t => { 
        newStandings[t.id] = { w: 0, l: 0, diff: 0 }; 
    });

    // 2. Loop through all matches and count wins/losses
    if (league && league.matches) {
        league.matches.forEach(m => {
            // Only count Regular Season and Super Week matches for the main table
            if (m.type !== 'regular' && m.type !== 'super') return;
            
            // Only count finished matches
            if (m.status === 'finished' && m.result) {
                const winnerName = m.result.winner;
                
                // Find the team objects
                // (Handles both object and ID references safely)
                const t1Id = typeof m.t1 === 'object' ? m.t1.id : m.t1;
                const t2Id = typeof m.t2 === 'object' ? m.t2.id : m.t2;
                const t1 = teams.find(t => t.id === t1Id);
                const t2 = teams.find(t => t.id === t2Id);

                if (!t1 || !t2) return;

                // Determine Winner and Loser IDs
                const winnerId = (t1.name === winnerName) ? t1Id : t2Id;
                const loserId = (t1.name === winnerName) ? t2Id : t1Id;

                // Update Stats
                if (newStandings[winnerId] && newStandings[loserId]) {
                    newStandings[winnerId].w += 1;
                    newStandings[loserId].l += 1;
                    
                    // Calculate Score Difference (e.g., 2:0 is +2, 2:1 is +1)
                    if (m.result.score) {
                        const parts = m.result.score.split(':');
                        if (parts.length === 2) {
                            const diff = Math.abs(parseInt(parts[0]) - parseInt(parts[1]));
                            newStandings[winnerId].diff += diff;
                            newStandings[loserId].diff -= diff;
                        }
                    }
                }
            }
        });
    }

    return newStandings;
};

export const calculateFinalStandings = (league) => {
    if (!league || !league.matches) return [];

    // Helper: Check if season is over
    const grandFinal = league.matches.find(m => m.type === 'playoff' && m.round === 5);
    const isSeasonOver = grandFinal && grandFinal.status === 'finished';

    if (!isSeasonOver) return [];

    // Helper: Handle String vs Number ID mismatch
    const safeId = (id) => (id && typeof id === 'object' ? id.id : Number(id));

    // Helper: Get Loser ID from a match
    const getLoserId = (m) => {
        if (!m || m.status !== 'finished' || !m.result) return null;
        const winnerName = m.result.winner;
        const t1Id = safeId(m.t1);
        const t2Id = safeId(m.t2);
        
        // Find team object to check name
        const t1Obj = teams.find(t => safeId(t.id) === t1Id);
        if (!t1Obj) return t2Id; // Safety fallback
        return t1Obj.name === winnerName ? t2Id : t1Id;
    };

    // Helper: Get Winner ID from a match
    const getWinnerId = (m) => {
        if (!m || m.status !== 'finished') return null;
        return teams.find(t => t.name === m.result.winner)?.id;
    };

    const findMatch = (type, round) => league.matches.find(m => m.type === type && m.round === round);
    
    // --- Determine IDs for each rank ---
    const finalMatch = findMatch('playoff', 5);
    const winnerId = getWinnerId(finalMatch);
    const runnerUpId = getLoserId(finalMatch);

    const r4Match = findMatch('playoff', 4);
    const thirdId = getLoserId(r4Match);

    const r3_1Match = findMatch('playoff', 3.1);
    const fourthId = getLoserId(r3_1Match);

    const r2_2Match = findMatch('playoff', 2.2);
    const fifthId = getLoserId(r2_2Match);

    const r2_1Match = findMatch('playoff', 2.1);
    const sixthId = getLoserId(r2_1Match);

    const piFinalMatch = findMatch('playin', 3);
    const seventhId = getLoserId(piFinalMatch);

    // 8th & 9th: Play-In Round 1 Losers
    const piR1Matches = league.matches.filter(m => m.type === 'playin' && m.round === 1);
    const piR1Losers = piR1Matches.map(m => getLoserId(m)).filter(id => id !== null);

    // Sort 8th/9th by Play-In Seed
    piR1Losers.sort((a, b) => {
        const getSeed = (tid) => league.playInSeeds?.find(s => s.id === tid)?.seed || 99;
        return getSeed(a) - getSeed(b);
    });

    // 10th: Group Stage Eliminated
    const tenthId = league.seasonSummary?.eliminated;

    const rankIds = [
        winnerId, runnerUpId, thirdId, fourthId, fifthId, sixthId, seventhId, 
        piR1Losers[0], piR1Losers[1], tenthId
    ];

    // --- Map IDs to Team Objects ---
    return rankIds.map((id, index) => {
        if (!id) return null;
        const t = teams.find(team => safeId(team.id) === safeId(id));
        if (!t) return null;
        return { rank: index + 1, team: t };
    }).filter(item => item !== null);
};

export const calculateGroupPoints = (league, groupType) => {
    if (!league || !league.groups || !league.groups[groupType]) return 0;
    const groupIds = league.groups[groupType];
    
    // Safety check for matches
    if (!league.matches) return 0;

    return league.matches.filter(m => {
        if (m.status !== 'finished' || !m.result) return false;
        // Only Regular and Super matches count for Group Scores
        if (m.type !== 'regular' && m.type !== 'super') return false;
        
        // Find winner ID
        const winnerTeam = teams.find(t => t.name === m.result.winner);
        if (!winnerTeam) return false;
        
        // Check if winner belongs to this group
        // (Handle both string/number ID types safely)
        return groupIds.some(id => String(id) === String(winnerTeam.id));
    }).reduce((acc, m) => acc + (m.type === 'super' ? 2 : 1), 0);
};

// Sort a list of team IDs based on standings (Wins > Diff)
export const sortGroupByStandings = (groupIds, standings) => {
    if (!groupIds) return [];
    
    // Create a copy to avoid mutating the original array
    return [...groupIds].sort((a, b) => {
        const recA = standings[a] || { w: 0, diff: 0 };
        const recB = standings[b] || { w: 0, diff: 0 };
        
        // 1. Sort by Wins (Higher is better)
        if (recA.w !== recB.w) return recB.w - recA.w;
        
        // 2. Sort by Score Difference (Higher is better)
        return recB.diff - recA.diff;
    });
};

export const createPlayInBracket = (league, standings, teams, baronWins, elderWins) => {
    // 1. Determine Winning Group
    let isBaronWinner;
    
    if (baronWins > elderWins) {
        isBaronWinner = true;
    } else if (baronWins < elderWins) {
        isBaronWinner = false;
    } else {
        // Tie-breaker 1: Score Difference
        const getDiff = (groupIds) => (groupIds || []).reduce((s, id) => s + ((standings[id]?.diff) || 0), 0);
        const baronDiff = getDiff(league.groups.baron);
        const elderDiff = getDiff(league.groups.elder);

        if (baronDiff > elderDiff) isBaronWinner = true;
        else if (baronDiff < elderDiff) isBaronWinner = false;
        else {
            // Tie-breaker 2: Total Team Power (Stat)
            const getPower = (groupIds) => (groupIds || []).reduce((s, id) => s + ((teams.find(t => t.id === id)?.power) || 0), 0);
            const baronPower = getPower(league.groups.baron);
            const elderPower = getPower(league.groups.elder);
            
            if (baronPower > elderPower) isBaronWinner = true;
            else if (baronPower < elderPower) isBaronWinner = false;
            else isBaronWinner = Math.random() < 0.5; // Tie-breaker 3: Coin Flip
        }
    }

    // 2. Sort Groups
    const baronSorted = sortGroupByStandings([...league.groups.baron], standings);
    const elderSorted = sortGroupByStandings([...league.groups.elder], standings);

    const seasonSummary = {
        winnerGroup: isBaronWinner ? 'Baron' : 'Elder',
        poTeams: [],
        playInTeams: [],
        eliminated: null
    };

    let playInIds = [];

    // 3. Assign Seeds based on Winner
    if (isBaronWinner) {
        // Winner Group: 1st/2nd -> Playoffs, 3rd/4th/5th -> Play-In
        seasonSummary.poTeams.push({ id: baronSorted[0], seed: 1 });
        seasonSummary.poTeams.push({ id: baronSorted[1], seed: 2 });
        playInIds.push(baronSorted[2], baronSorted[3], baronSorted[4]);

        // Loser Group: 1st -> Playoffs (Seed 3), 2nd/3rd/4th -> Play-In
        seasonSummary.poTeams.push({ id: elderSorted[0], seed: 3 });
        playInIds.push(elderSorted[1], elderSorted[2], elderSorted[3]);
        
        // Loser Group 5th -> Eliminated
        seasonSummary.eliminated = elderSorted[4];
    } else {
        // (Same logic reversed for Elder win)
        seasonSummary.poTeams.push({ id: elderSorted[0], seed: 1 });
        seasonSummary.poTeams.push({ id: elderSorted[1], seed: 2 });
        playInIds.push(elderSorted[2], elderSorted[3], elderSorted[4]);

        seasonSummary.poTeams.push({ id: baronSorted[0], seed: 3 });
        playInIds.push(baronSorted[1], baronSorted[2], baronSorted[3]);
        seasonSummary.eliminated = baronSorted[4];
    }

    // 4. Sort Play-In Teams (Seeds 1-6 for Play-In)
    playInIds.sort((a, b) => {
        const recA = standings[a] || { w: 0, diff: 0 };
        const recB = standings[b] || { w: 0, diff: 0 };
        if (recA.w !== recB.w) return recB.w - recA.w;
        if (recA.diff !== recB.diff) return recB.diff - recA.diff;
        return 0;
    });

    const playInSeeds = playInIds.map((tid, idx) => ({ id: tid, seed: idx + 1 }));
    seasonSummary.playInTeams = playInSeeds;

    // 5. Generate Round 1 Matches (Seed 3 vs 6, Seed 4 vs 5)
    // (Seeds 1 and 2 get a bye)
    const seed3 = playInSeeds[2].id;
    const seed6 = playInSeeds[5].id;
    const seed4 = playInSeeds[3].id;
    const seed5 = playInSeeds[4].id;

    // [FIX] Explicitly added 'blueSidePriority' to these matches.
    // Higher seed (seed3 and seed4) are 't1', so we set priority to them.
    const newMatches = [
        { 
            id: Date.now() + 1, 
            t1: seed3, 
            t2: seed6, 
            blueSidePriority: seed3, // Force Seed 3 to Blue
            date: '2.6 (금)', 
            time: '17:00', 
            type: 'playin', 
            format: 'BO3', 
            status: 'pending', 
            round: 1, 
            label: '플레이-인 1라운드' 
        },
        { 
            id: Date.now() + 2, 
            t1: seed4, 
            t2: seed5, 
            blueSidePriority: seed4, // Force Seed 4 to Blue
            date: '2.6 (금)', 
            time: '19:30', 
            type: 'playin', 
            format: 'BO3', 
            status: 'pending', 
            round: 1, 
            label: '플레이-인 1라운드' 
        }
    ];

    return { newMatches, playInSeeds, seasonSummary };
};

export const createPlayInRound2Matches = (currentMatches, seed1, seed2, pickedTeam, remainingTeam) => {
    const r2Matches = [
        { 
            id: Date.now() + 100, 
            t1: seed1.id, 
            t2: pickedTeam.id, 
            date: '2.7 (토)', 
            time: '17:00', 
            type: 'playin', 
            format: 'BO3', 
            status: 'pending', 
            round: 2, 
            label: '플레이-인 2라운드' 
        },
        { 
            id: Date.now() + 101, 
            t1: seed2.id, 
            t2: remainingTeam.id, 
            date: '2.7 (토)', 
            time: '19:30', 
            type: 'playin', 
            format: 'BO3', 
            status: 'pending', 
            round: 2, 
            label: '플레이-인 2라운드' 
        }
    ];
    
    // [FIX] Used compareDates for correct sorting
    return [...currentMatches, ...r2Matches].sort((a, b) => compareDates(a.date, b.date));
};

export const createPlayInFinalMatch = (currentMatches, teams) => {
    const r2Matches = currentMatches.filter(m => m.type === 'playin' && m.round === 2);
    
    // Determine the losers of Round 2
    const losers = r2Matches.map(m => {
       const winnerName = m.result.winner;
       // Safety check for object vs ID
       const t1Id = typeof m.t1 === 'object' ? m.t1.id : m.t1;
       const t2Id = typeof m.t2 === 'object' ? m.t2.id : m.t2;
       
       const t1Obj = teams.find(t => t.id === t1Id);
       const t2Obj = teams.find(t => t.id === t2Id);
       
       return t1Obj.name === winnerName ? t2Obj : t1Obj;
    });

    const finalMatch = { 
        id: Date.now() + 200, 
        t1: losers[0].id, 
        t2: losers[1].id, 
        date: '2.8 (일)', 
        time: '17:00', 
        type: 'playin', 
        format: 'BO5', 
        status: 'pending', 
        round: 3, 
        label: '플레이-인 최종전', 
        blueSidePriority: 'coin' 
    };
    
    // [FIX] Used compareDates for correct sorting
    return [...currentMatches, finalMatch].sort((a, b) => compareDates(a.date, b.date));
};

export const createPlayoffRound2Matches = (currentMatches, seed1, seed2, pickedWinnerId, remainingWinnerId, loser1Id, loser2Id) => {
    const newPlayoffMatches = [
        // R2 Winners (Higher Seeds are t1 -> Blue Side)
        { id: Date.now() + 400, round: 2, match: 1, label: '승자조 2R', t1: seed1, t2: pickedWinnerId, date: '2.13 (금)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' },
        { id: Date.now() + 401, round: 2, match: 2, label: '승자조 2R', t1: seed2, t2: remainingWinnerId, date: '2.13 (금)', time: '19:30', type: 'playoff', format: 'BO5', status: 'pending' },
        // R2 Losers (Random priority for losers bracket R1)
        { id: Date.now() + 402, round: 2.1, match: 1, label: '패자조 1R', t1: loser1Id, t2: loser2Id, date: '2.14 (토)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' },
    ];
    
    // [FIX] Used compareDates for correct sorting
    return [...currentMatches, ...newPlayoffMatches].sort((a, b) => compareDates(a.date, b.date));
};

export const createPlayoffRound3Matches = (currentMatches, playoffSeeds, teams) => {
    // Helper to resolve Winner ID from Name
    const getWinnerId = (m) => {
        const winnerName = m.result.winner;
        const team = teams.find(t => t.name === winnerName);
        return team ? team.id : null;
    };
    // Helper to get Loser ID
    const getLoserId = (m, winnerId) => (m.t1 === winnerId ? m.t2 : m.t1);

    const r2wMatches = currentMatches.filter(m => m.type === 'playoff' && m.round === 2);
    const r2lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 2.1);

    const r2wWinners = r2wMatches.map(m => getWinnerId(m));
    
    // Sort losers by seed (Higher seed goes to L2)
    const r2wLosers = r2wMatches.map(m => {
        const wId = getWinnerId(m);
        const lId = getLoserId(m, wId);
        const seedObj = playoffSeeds.find(s => s.id === lId) || { seed: 99 };
        return { id: lId, seed: seedObj.seed };
    });
    r2wLosers.sort((a,b) => a.seed - b.seed); 

    const r2lWinner = getWinnerId(r2lMatch);

    const newPlayoffMatches = [
        // Winner Bracket Final
        { id: Date.now() + 500, round: 3, match: 1, label: '승자조 결승', t1: r2wWinners[0], t2: r2wWinners[1], date: '2.18 (수)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' },
        // Loser Bracket R2
        { id: Date.now() + 501, round: 2.2, match: 1, label: '패자조 2R', t1: r2wLosers[1].id, t2: r2lWinner, date: '2.15 (일)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' },
    ];

    // [FIX] Used compareDates for correct sorting
    return [...currentMatches, ...newPlayoffMatches].sort((a, b) => compareDates(a.date, b.date));
};

export const createPlayoffLoserRound3Match = (currentMatches, playoffSeeds, teams) => {
    const getWinnerId = (m) => teams.find(t => t.name === m.result.winner).id;
    const getLoserId = (m, winnerId) => (m.t1 === winnerId ? m.t2 : m.t1);

    const r2wMatchesFinished = currentMatches.filter(m => m.round === 2 && m.status === 'finished');
    const r2_2Match = currentMatches.find(m => m.type === 'playoff' && m.round === 2.2);
    
    // Sort losers by seed to find the highest seed loser from Winner Bracket R2
    // Note: The logic in your original file implies this step determines who waits in R3.1
    const r2wLosers = r2wMatchesFinished.map(m => {
        const wId = getWinnerId(m);
        const lId = getLoserId(m, wId);
        const seedObj = playoffSeeds.find(s => s.id === lId) || { seed: 99 };
        return { id: lId, seed: seedObj.seed };
    });
    r2wLosers.sort((a,b) => a.seed - b.seed); 
    
    const highestSeedLoser = r2wLosers[0].id;
    const r2_2Winner = getWinnerId(r2_2Match);

    const newMatch = { id: Date.now() + 600, round: 3.1, match: 1, label: '패자조 3R', t1: highestSeedLoser, t2: r2_2Winner, date: '2.19 (목)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending' };
    
    // [FIX] Used compareDates for correct sorting
    return [...currentMatches, newMatch].sort((a, b) => compareDates(a.date, b.date));
};

export const createPlayoffQualifierMatch = (currentMatches, teams) => {
    const getWinnerId = (m) => teams.find(t => t.name === m.result.winner).id;
    const getLoserId = (m, winnerId) => (m.t1 === winnerId ? m.t2 : m.t1);

    const r3wMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3);
    const r3lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3.1);

    const r3wWinner = getWinnerId(r3wMatch);
    const r3wLoser = getLoserId(r3wMatch, r3wWinner);
    const r3lWinner = getWinnerId(r3lMatch);

    const newMatch = { 
        id: Date.now() + 700, 
        round: 4, 
        match: 1, 
        label: '결승 진출전', 
        t1: r3wLoser, 
        t2: r3lWinner, 
        date: '2.21 (토)', 
        time: '17:00', 
        type: 'playoff', 
        format: 'BO5', 
        status: 'pending' 
    };
    
    // [FIX] Used compareDates for correct sorting
    return [...currentMatches, newMatch].sort((a, b) => compareDates(a.date, b.date));
};

export const createPlayoffFinalMatch = (currentMatches, teams) => {
    const getWinnerId = (m) => teams.find(t => t.name === m.result.winner).id;

    const r3wMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3);
    const r4Match = currentMatches.find(m => m.type === 'playoff' && m.round === 4);

    const r3wWinner = getWinnerId(r3wMatch); // Winner Bracket Champion
    const r4Winner = getWinnerId(r4Match);   // Loser Bracket Champion

    const newMatch = { 
        id: Date.now() + 800, 
        round: 5, 
        match: 1, 
        label: '결승전', 
        t1: r3wWinner, 
        t2: r4Winner, 
        date: '2.22 (일)', 
        time: '17:00', 
        type: 'playoff', 
        format: 'BO5', 
        status: 'pending' 
    };
    
    // [FIX] Used compareDates for correct sorting
    return [...currentMatches, newMatch].sort((a, b) => compareDates(a.date, b.date));
};


// ============================================================
// FST WORLD TOURNAMENT BRACKET LOGIC
// ============================================================
// 8 participants: Champions of LCK, LPL, LEC, LCS, LCP, CBLOL
//                 + Runner-Ups of LCK and LPL
// Format: Double Elimination Group Stage → Cross-Group Playoffs → Finals
// Location: 상파울루 라이엇 게임즈 아레나 | BO5 Fearless Draft
// ============================================================

const FST_ID_BASE = 900000; // High offset to avoid ID collisions with LCK bracket matches
const FST_VENUE = '상파울루 라이엇 게임즈 아레나';

// Internal: find an FST match by its round key (e.g. 'GG1', 'PG2', 'Finals')
const findFSTMatch = (matches, fstRound) =>
    matches.find(m => m.fstRound === fstRound);

// Internal: get the fstId string of the winning team in a finished FST match
const getFSTWinnerId = (match, fstTeams) => {
    if (!match || match.status !== 'finished' || !match.result) return null;
    const winnerName = match.result.winner;
    const team = fstTeams.find(t => t.name === winnerName);
    return team ? team.fstId : null;
};

// Internal: get the fstId string of the losing team in a finished FST match
const getFSTLoserId = (match, fstTeams) => {
    if (!match || match.status !== 'finished') return null;
    const winnerFstId = getFSTWinnerId(match, fstTeams);
    if (!winnerFstId) return null;
    // t1/t2 are fstId strings — the loser is whichever isn't the winner
    return match.t1 === winnerFstId ? match.t2 : match.t1;
};

/**
 * createFSTBracket
 * ─────────────────────────────────────────────────────────────
 * Builds the initial FST tournament state with Group Stage Wave 1 (GG1–GG4).
 *
 * @param {Array} fstTeams  8 objects shaped as:
 *   { fstId, league, slot, name, fullName, colors, power }
 *   fstId examples: 'LCK_C', 'LCK_RU', 'LPL_C', 'LPL_RU',
 *                   'LEC_C', 'LCS_C', 'LCP_C', 'CBLOL_C'
 *
 * @returns {Object}  Initial fst state:
 *   { status, teams, groups: { A, B }, matches }
 */
export const createFSTBracket = (fstTeams) => {
    // ── 1. Separate into constraint buckets ──────────────────
    const lckTeams  = fstTeams.filter(t => t.league === 'LCK');  // must be split across groups
    const lplTeams  = fstTeams.filter(t => t.league === 'LPL');  // must be split across groups
    const others    = fstTeams.filter(t => t.league !== 'LCK' && t.league !== 'LPL');

    // ── 2. Randomly decide which LCK / LPL rep goes to Group A ──
    const [lckA, lckB] = Math.random() < 0.5
        ? [lckTeams[0].fstId, lckTeams[1].fstId]
        : [lckTeams[1].fstId, lckTeams[0].fstId];

    const [lplA, lplB] = Math.random() < 0.5
        ? [lplTeams[0].fstId, lplTeams[1].fstId]
        : [lplTeams[1].fstId, lplTeams[0].fstId];

    // ── 3. Shuffle the remaining 4 teams and split 2/2 ──────
    const othersShuffled = [...others]
        .sort(() => Math.random() - 0.5)
        .map(t => t.fstId);

    const groupA = [lckA, lplA, othersShuffled[0], othersShuffled[1]];
    const groupB = [lckB, lplB, othersShuffled[2], othersShuffled[3]];

    // ── 4. Shuffle within each group for random first pairings ──
    const sA = [...groupA].sort(() => Math.random() - 0.5);
    const sB = [...groupB].sort(() => Math.random() - 0.5);

    // ── 5. Build GG1–GG4 (only pre-generatable matches) ────────
    const matches = [
        // ── Group A Wave 1 ────────────────────────────────────
        {
            id: FST_ID_BASE + 1,
            fstRound: 'GG1',
            group: 'A',
            t1: sA[0], t2: sA[1],
            date: '3.16 (월)', time: '22:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 그룹 A – 1경기',
            venue: FST_VENUE,
        },
        {
            id: FST_ID_BASE + 3,
            fstRound: 'GG3',
            group: 'A',
            t1: sA[2], t2: sA[3],
            date: '3.17 (화)', time: '22:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 그룹 A – 2경기',
            venue: FST_VENUE,
        },
        // ── Group B Wave 1 ────────────────────────────────────
        {
            id: FST_ID_BASE + 2,
            fstRound: 'GG2',
            group: 'B',
            t1: sB[0], t2: sB[1],
            date: '3.17 (화)', time: '3:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 그룹 B – 1경기',
            venue: FST_VENUE,
        },
        {
            id: FST_ID_BASE + 4,
            fstRound: 'GG4',
            group: 'B',
            t1: sB[2], t2: sB[3],
            date: '3.18 (수)', time: '3:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 그룹 B – 2경기',
            venue: FST_VENUE,
        },
    ];

    return {
        status: 'group_stage',
        teams: fstTeams,
        groups: { A: groupA, B: groupB },
        matches: matches.sort((a, b) => compareDates(a.date, b.date)),
    };
};

/**
 * createFSTGroupWave2A
 * ─────────────────────────────────────────────────────────────
 * Triggered when BOTH GG1 and GG3 are finished.
 * Generates:  GG5 (Group A Winner Bracket)
 *             GG8 (Group A Loser Bracket / Elimination)
 */
export const createFSTGroupWave2A = (fstMatches, fstTeams) => {
    const gg1 = findFSTMatch(fstMatches, 'GG1');
    const gg3 = findFSTMatch(fstMatches, 'GG3');
    if (!gg1 || !gg3 || gg1.status !== 'finished' || gg3.status !== 'finished') return fstMatches;
    if (findFSTMatch(fstMatches, 'GG5')) return fstMatches; // already generated

    const newMatches = [
        // GG5 — Group A Winner Bracket Final (winner goes to playoffs undefeated)
        {
            id: FST_ID_BASE + 5,
            fstRound: 'GG5',
            group: 'A',
            t1: getFSTWinnerId(gg1, fstTeams),
            t2: getFSTWinnerId(gg3, fstTeams),
            date: '3.18 (수)', time: '22:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 그룹 A – 승자전',
            venue: FST_VENUE,
        },
        // GG8 — Group A Loser Bracket (loser is eliminated)
        {
            id: FST_ID_BASE + 8,
            fstRound: 'GG8',
            group: 'A',
            t1: getFSTLoserId(gg1, fstTeams),
            t2: getFSTLoserId(gg3, fstTeams),
            date: '3.20 (금)', time: '3:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 그룹 A – 패자전',
            venue: FST_VENUE,
        },
    ];

    return [...fstMatches, ...newMatches].sort((a, b) => compareDates(a.date, b.date));
};

/**
 * createFSTGroupWave2B
 * ─────────────────────────────────────────────────────────────
 * Triggered when BOTH GG2 and GG4 are finished.
 * Generates:  GG6 (Group B Winner Bracket)
 *             GG7 (Group B Loser Bracket / Elimination)
 */
export const createFSTGroupWave2B = (fstMatches, fstTeams) => {
    const gg2 = findFSTMatch(fstMatches, 'GG2');
    const gg4 = findFSTMatch(fstMatches, 'GG4');
    if (!gg2 || !gg4 || gg2.status !== 'finished' || gg4.status !== 'finished') return fstMatches;
    if (findFSTMatch(fstMatches, 'GG6')) return fstMatches;

    const newMatches = [
        // GG6 — Group B Winner Bracket Final
        {
            id: FST_ID_BASE + 6,
            fstRound: 'GG6',
            group: 'B',
            t1: getFSTWinnerId(gg2, fstTeams),
            t2: getFSTWinnerId(gg4, fstTeams),
            date: '3.19 (목)', time: '3:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 그룹 B – 승자전',
            venue: FST_VENUE,
        },
        // GG7 — Group B Loser Bracket
        {
            id: FST_ID_BASE + 7,
            fstRound: 'GG7',
            group: 'B',
            t1: getFSTLoserId(gg2, fstTeams),
            t2: getFSTLoserId(gg4, fstTeams),
            date: '3.19 (목)', time: '22:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 그룹 B – 패자전',
            venue: FST_VENUE,
        },
    ];

    return [...fstMatches, ...newMatches].sort((a, b) => compareDates(a.date, b.date));
};

/**
 * createFSTGroupWave3A
 * ─────────────────────────────────────────────────────────────
 * Triggered when BOTH GG5 and GG8 are finished.
 * Generates:  GG9 (Group A Elimination — last chance for the survivor)
 */
export const createFSTGroupWave3A = (fstMatches, fstTeams) => {
    const gg5 = findFSTMatch(fstMatches, 'GG5');
    const gg8 = findFSTMatch(fstMatches, 'GG8');
    if (!gg5 || !gg8 || gg5.status !== 'finished' || gg8.status !== 'finished') return fstMatches;
    if (findFSTMatch(fstMatches, 'GG9')) return fstMatches;

    const newMatch = {
        id: FST_ID_BASE + 9,
        fstRound: 'GG9',
        group: 'A',
        t1: getFSTLoserId(gg5, fstTeams),   // lost one but still alive
        t2: getFSTWinnerId(gg8, fstTeams),  // survived elimination
        date: '3.20 (금)', time: '22:00',
        type: 'fst', format: 'BO5', fearless: true,
        status: 'pending',
        label: 'FST 그룹 A – 최종전',
        venue: FST_VENUE,
    };

    return [...fstMatches, newMatch].sort((a, b) => compareDates(a.date, b.date));
};

/**
 * createFSTGroupWave3B
 * ─────────────────────────────────────────────────────────────
 * Triggered when BOTH GG6 and GG7 are finished.
 * Generates:  GG10 (Group B Elimination)
 */
export const createFSTGroupWave3B = (fstMatches, fstTeams) => {
    const gg6 = findFSTMatch(fstMatches, 'GG6');
    const gg7 = findFSTMatch(fstMatches, 'GG7');
    if (!gg6 || !gg7 || gg6.status !== 'finished' || gg7.status !== 'finished') return fstMatches;
    if (findFSTMatch(fstMatches, 'GG10')) return fstMatches;

    const newMatch = {
        id: FST_ID_BASE + 10,
        fstRound: 'GG10',
        group: 'B',
        t1: getFSTLoserId(gg6, fstTeams),
        t2: getFSTWinnerId(gg7, fstTeams),
        date: '3.21 (토)', time: '3:00',
        type: 'fst', format: 'BO5', fearless: true,
        status: 'pending',
        label: 'FST 그룹 B – 최종전',
        venue: FST_VENUE,
    };

    return [...fstMatches, newMatch].sort((a, b) => compareDates(a.date, b.date));
};

/**
 * createFSTPlayoffs
 * ─────────────────────────────────────────────────────────────
 * Triggered when BOTH GG9 and GG10 are finished.
 * Generates the two cross-group playoff semifinals (PG1, PG2).
 *
 *   PG1: Group A undefeated champion (GG5 winner) vs Group B survivor (GG10 winner)
 *   PG2: Group B undefeated champion (GG6 winner) vs Group A survivor (GG9 winner)
 */
export const createFSTPlayoffs = (fstMatches, fstTeams) => {
    const gg5  = findFSTMatch(fstMatches, 'GG5');
    const gg6  = findFSTMatch(fstMatches, 'GG6');
    const gg9  = findFSTMatch(fstMatches, 'GG9');
    const gg10 = findFSTMatch(fstMatches, 'GG10');

    if (!gg9 || !gg10 || gg9.status !== 'finished' || gg10.status !== 'finished') return fstMatches;
    if (findFSTMatch(fstMatches, 'PG1')) return fstMatches;

    const newMatches = [
        {
            id: FST_ID_BASE + 11,
            fstRound: 'PG1',
            t1: getFSTWinnerId(gg5, fstTeams),   // Group A undefeated
            t2: getFSTWinnerId(gg10, fstTeams),  // Group B survivor
            date: '3.21 (토)', time: '22:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 준결승 1',
            venue: FST_VENUE,
            blueSidePriority: 'coin',
        },
        {
            id: FST_ID_BASE + 12,
            fstRound: 'PG2',
            t1: getFSTWinnerId(gg6, fstTeams),   // Group B undefeated
            t2: getFSTWinnerId(gg9, fstTeams),   // Group A survivor
            date: '3.22 (일)', time: '3:00',
            type: 'fst', format: 'BO5', fearless: true,
            status: 'pending',
            label: 'FST 준결승 2',
            venue: FST_VENUE,
            blueSidePriority: 'coin',
        },
    ];

    return [...fstMatches, ...newMatches].sort((a, b) => compareDates(a.date, b.date));
};

/**
 * createFSTFinals
 * ─────────────────────────────────────────────────────────────
 * Triggered when BOTH PG1 and PG2 are finished.
 * Generates the FST Grand Final.
 */
export const createFSTFinals = (fstMatches, fstTeams) => {
    const pg1 = findFSTMatch(fstMatches, 'PG1');
    const pg2 = findFSTMatch(fstMatches, 'PG2');
    if (!pg1 || !pg2 || pg1.status !== 'finished' || pg2.status !== 'finished') return fstMatches;
    if (findFSTMatch(fstMatches, 'Finals')) return fstMatches;

    const finalMatch = {
        id: FST_ID_BASE + 13,
        fstRound: 'Finals',
        t1: getFSTWinnerId(pg1, fstTeams),
        t2: getFSTWinnerId(pg2, fstTeams),
        date: '3.22 (일)', time: '22:00',
        type: 'fst', format: 'BO5', fearless: true,
        status: 'pending',
        label: '🏆 FST 결승전',
        venue: FST_VENUE,
        blueSidePriority: 'coin',
    };

    return [...fstMatches, finalMatch].sort((a, b) => compareDates(a.date, b.date));
};