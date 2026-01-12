import { teams } from '../data/teams';

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

export const calculateGroupScore = (groupType) => {
    if (!league.groups || !league.groups[groupType]) return 0;
    const groupIds = league.groups[groupType];
    
    return league.matches.filter(m => {
        if (m.status !== 'finished') return false;
        // [CRITICAL FIX] Ensure only Regular and Super matches count for Group Scores
        if (m.type !== 'regular' && m.type !== 'super') return false;
        
        const winnerTeam = teams.find(t => t.name === m.result.winner);
        if (!winnerTeam) return false;
        return groupIds.includes(winnerTeam.id);
    }).reduce((acc, m) => acc + (m.type === 'super' ? 2 : 1), 0);
  };

  export const computeFinalStandings = (league) => {
    // Check if Grand Final (Round 5) is finished
    const grandFinal = league.matches.find(m => m.type === 'playoff' && m.round === 5);
    const isSeasonOver = grandFinal && grandFinal.status === 'finished';

    if (!isSeasonOver) return [];
    
    // Helpers for ID safety
    const safeId = (id) => (id && typeof id === 'object' ? id.id : Number(id));
    const getWinnerId = (m) => (m && m.status === 'finished' ? teams.find(t => t.name === m.result.winner)?.id : null);
    const getLoserId = (m) => {
        if (!m || m.status !== 'finished' || !m.result) return null;
        const wId = getWinnerId(m);
        const t1Id = safeId(m.t1);
        const t2Id = safeId(m.t2);
        return t1Id === wId ? t2Id : t1Id;
    };

    const findMatch = (type, round) => league.matches.find(m => m.type === type && m.round === round);
    
    // 1. Determine IDs for every rank
    const winnerId = getWinnerId(grandFinal);
    const runnerUpId = getLoserId(grandFinal);
    const thirdId = getLoserId(findMatch('playoff', 4));
    const fourthId = getLoserId(findMatch('playoff', 3.1));
    const fifthId = getLoserId(findMatch('playoff', 2.2));
    const sixthId = getLoserId(findMatch('playoff', 2.1));
    const seventhId = getLoserId(findMatch('playin', 3));

    // 8th & 9th: Play-In Round 1 Losers (Sorted by Seed)
    const piR1Matches = league.matches.filter(m => m.type === 'playin' && m.round === 1);
    const piR1Losers = piR1Matches.map(m => getLoserId(m)).filter(id => id !== null);
    
    piR1Losers.sort((a, b) => {
        const seedA = league.playInSeeds?.find(s => s.id === a)?.seed || 99;
        const seedB = league.playInSeeds?.find(s => s.id === b)?.seed || 99;
        return seedA - seedB;
    });

    const tenthId = league.seasonSummary?.eliminated;

    const rankIds = [
        winnerId, runnerUpId, thirdId, fourthId, fifthId, sixthId, seventhId, 
        piR1Losers[0], piR1Losers[1], tenthId
    ];

    // 2. Map IDs to Team Objects
    return rankIds.map((id, index) => {
        if (!id) return null;
        const t = teams.find(team => safeId(team.id) === safeId(id));
        if (!t) return null;
        return { rank: index + 1, team: t };
    }).filter(item => item !== null);
};