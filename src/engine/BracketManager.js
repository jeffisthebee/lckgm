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