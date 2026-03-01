// src/engine/scheduleLogic.js

// [NEW] Helper to compare dates correctly (e.g., "2.7" vs "2.11")
// [NEW] Precision Time Checker for Global Auto-Sync
export const compareDatesObj = (a, b) => {
    if (!a || !b || !a.date || !b.date) return 0;
    const [monthA, dayA] = a.date.split(' ')[0].split('.').map(Number);
    const [monthB, dayB] = b.date.split(' ')[0].split('.').map(Number);
    
    if (monthA !== monthB) return monthA - monthB;
    if (dayA !== dayB) return dayA - dayB;
    
    if (a.time && b.time) {
        const [hA, mA] = a.time.split(':').map(Number);
        const [hB, mB] = b.time.split(':').map(Number);
        if (hA !== hB) return hA - hB;
        return mA - mB;
    }
    return 0;
};

// Helper to shuffle array (Fisher-Yates)
const shuffle = (array) => {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
};

// --- BACKTRACKING SCHEDULER (Daily Slot Assignment) ---
const solveWeekSchedule = (matches, days, slotsPerDay) => {
    for (let attempt = 0; attempt < 50; attempt++) {
        const pool = shuffle([...matches]);
        const schedule = Array(days.length).fill(null).map(() => []); 
        const teamActivity = {}; 

        if (runBacktrack(0, pool, schedule, teamActivity, slotsPerDay, days.length)) {
            const result = [];
            schedule.forEach((dayMatches, dayIdx) => {
                dayMatches.forEach((m, slotIdx) => {
                    result.push({
                        ...m,
                        date: days[dayIdx],
                        time: slotIdx === 0 ? '17:00' : '19:30'
                    });
                });
            });
            return result;
        }
    }
    return fallbackSchedule(matches, days, slotsPerDay);
};

const runBacktrack = (matchIdx, pool, schedule, teamActivity, slotsPerDay, numDays) => {
    if (matchIdx === pool.length) return true;

    const match = pool[matchIdx];
    const t1 = match.t1;
    const t2 = match.t2;

    for (let day = 0; day < numDays; day++) {
        if (schedule[day].length >= slotsPerDay) continue;
        if (hasPlayedOnDay(t1, day, teamActivity) || hasPlayedOnDay(t2, day, teamActivity)) continue;
        if (hasPlayedOnDay(t1, day - 1, teamActivity) || hasPlayedOnDay(t1, day + 1, teamActivity)) continue;
        if (hasPlayedOnDay(t2, day - 1, teamActivity) || hasPlayedOnDay(t2, day + 1, teamActivity)) continue;

        schedule[day].push(match);
        setPlayed(t1, day, true, teamActivity);
        setPlayed(t2, day, true, teamActivity);

        if (runBacktrack(matchIdx + 1, pool, schedule, teamActivity, slotsPerDay, numDays)) return true;

        schedule[day].pop();
        setPlayed(t1, day, false, teamActivity);
        setPlayed(t2, day, false, teamActivity);
    }
    return false;
};

const hasPlayedOnDay = (teamId, dayIdx, activityMap) => {
    if (dayIdx < 0) return false;
    return !!(activityMap[teamId] && activityMap[teamId][dayIdx]);
};

const setPlayed = (teamId, dayIdx, status, activityMap) => {
    if (!activityMap[teamId]) activityMap[teamId] = {};
    if (status) activityMap[teamId][dayIdx] = true;
    else delete activityMap[teamId][dayIdx];
};

const fallbackSchedule = (matches, days, slotsPerDay) => {
    return matches.map((m, i) => ({
        ...m,
        date: days[Math.floor(i / slotsPerDay)] || days[days.length - 1],
        time: '17:00'
    }));
};

// --- MAIN GENERATOR ---
export const generateSchedule = (baronIds, elderIds) => {
    const getID = (t) => (typeof t === 'object' ? t.id : t);
    
    // [CRITICAL] Do NOT shuffle the input arrays. 
    // We assume baronIds and elderIds are passed in Pick Order (Index 0 = Captain, Index 1 = 1st Pick...)
    const barons = baronIds.map(getID);
    const elders = elderIds.map(getID);
    const allTeamIds = [...barons, ...elders];

    // --- 1. Construct 5 Perfect Matchings (Cyclic Offsets) ---
    // Offset 0: B[0]vsE[0], B[1]vsE[1]... (This is the Rivalry/Draft Order Match)
    // Offset 1..4: The other combinations needed for a full Round Robin across groups
    const matchings = [];
    for (let offset = 0; offset < 5; offset++) {
        const roundMatches = [];
        for (let i = 0; i < 5; i++) {
            roundMatches.push({
                t1: barons[i],
                t2: elders[(i + offset) % 5] 
            });
        }
        matchings.push(roundMatches);
    }

    // --- 2. Assign Weeks ---
    
    // Super Week (Week 3) gets Offset 0 (Rivalry Matches: Pick Order Preserved)
    const superWeekPool = [...matchings[0]]; 

    // Weeks 1 & 2 get Offsets 1, 2, 3, 4
    // We shuffle these 4 rounds so the order of opponents in the first 2 weeks varies
    const regularRounds = shuffle([ matchings[1], matchings[2], matchings[3], matchings[4] ]);
    
    const week1Pool = [...regularRounds[0], ...regularRounds[1]]; // 10 matches
    const week2Pool = [...regularRounds[2], ...regularRounds[3]]; // 10 matches

    // --- 3. Solve Daily Schedules ---
    const regularDays1 = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
    const regularDays2 = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
    const superDays = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)']; 

    const scheduleW1 = solveWeekSchedule(week1Pool, regularDays1, 2);
    const scheduleW2 = solveWeekSchedule(week2Pool, regularDays2, 2);
    const scheduleSuper = solveWeekSchedule(superWeekPool, superDays, 1);

    let allScheduled = [...scheduleW1, ...scheduleW2, ...scheduleSuper];

    // --- 4. Side Selection & Balancing ---
    // Randomize initial sides
    allScheduled = allScheduled.map(m => {
        const coin = Math.random() < 0.5;
        return {
            ...m,
            t1: coin ? m.t1 : m.t2, // t1 will be BLUE side initially
            t2: coin ? m.t2 : m.t1, // t2 will be RED side initially
        };
    });

    // Balance Loop: Ensure min 2 Blue Sides per team
    const getBlueCounts = (matches) => {
        const counts = {};
        allTeamIds.forEach(id => counts[id] = 0);
        matches.forEach(m => counts[m.t1] = (counts[m.t1] || 0) + 1);
        return counts;
    };

    let counts = getBlueCounts(allScheduled);
    let safety = 0;
    while (safety < 1000) {
        const unluckyTeam = allTeamIds.find(id => counts[id] < 2);
        if (!unluckyTeam) break;

        // Try to swap a game where opponent has > 2 Blue sides
        const candidates = allScheduled.filter(m => String(m.t2) === String(unluckyTeam) && counts[m.t1] > 2);
        
        let swapMatch;
        if (candidates.length > 0) {
            swapMatch = candidates[0];
        } else {
            // Force swap if necessary
            const force = allScheduled.filter(m => String(m.t2) === String(unluckyTeam));
            if (force.length > 0) swapMatch = force[0];
        }

        if (swapMatch) {
            const temp = swapMatch.t1;
            swapMatch.t1 = swapMatch.t2;
            swapMatch.t2 = temp;
            counts = getBlueCounts(allScheduled);
        } else {
            break; 
        }
        safety++;
    }

    // [FIX] Explicitly lock the side priority to t1 (Blue)
    allScheduled = allScheduled.map(m => ({
        ...m,
        blueSidePriority: m.t1 
    }));

    // --- 5. Formatting ---
    allScheduled = allScheduled.map(m => {
        const isSuper = superDays.includes(m.date);
        return {
            ...m,
            id: Date.now() + Math.floor(Math.random()*1000000), 
            type: isSuper ? 'super' : 'regular',
            format: isSuper ? 'BO5' : 'BO3',
            status: 'pending'
        };
    });

    // [FIX] Sort Chronologically using the robust compareDates helper
    // [FIX] Sort Chronologically using the NEW precision object checker!
    allScheduled.sort(compareDatesObj);

    return allScheduled;
};

// ==========================================
// [NEW] GLOBAL LEAGUES SCHEDULE LOGIC
// ==========================================

export const generateLCPRegularSchedule = (teams) => {
    let pairs = [];
    // Create single round-robin (8 teams = 28 games)
    for(let i=0; i<teams.length; i++){
        for(let j=i+1; j<teams.length; j++){
            // [FIX] Use name if id doesn't exist to prevent TBD!
            const t1Id = teams[i].id || teams[i].name;
            const t2Id = teams[j].id || teams[j].name;
            pairs.push({ t1: t1Id, t2: t2Id });
        }
    }
    
    // Shuffle the pairs for randomness
    pairs = pairs.sort(() => Math.random() - 0.5);

    // The exact 28 slots for the LCP schedule
    const slots = [
        { date: '1.16 (금)', time: '15:00' }, { date: '1.16 (금)', time: '17:30' },
        { date: '1.17 (토)', time: '15:00' }, { date: '1.17 (토)', time: '17:30' },
        { date: '1.18 (일)', time: '15:00' }, { date: '1.18 (일)', time: '17:30' },
        { date: '1.23 (금)', time: '15:00' }, { date: '1.23 (금)', time: '17:30' },
        { date: '1.24 (토)', time: '15:00' }, { date: '1.24 (토)', time: '17:30' },
        { date: '1.25 (일)', time: '15:00' }, { date: '1.25 (일)', time: '17:30' },
        { date: '1.29 (목)', time: '15:00' }, { date: '1.29 (목)', time: '17:30' },
        { date: '1.30 (금)', time: '15:00' }, { date: '1.30 (금)', time: '17:30' },
        { date: '1.31 (토)', time: '15:00' }, { date: '1.31 (토)', time: '17:30' },
        { date: '2.1 (일)', time: '15:00' },  { date: '2.1 (일)', time: '17:30' },
        { date: '2.5 (목)', time: '15:00' },  { date: '2.5 (목)', time: '17:30' },
        { date: '2.6 (금)', time: '15:00' },  { date: '2.6 (금)', time: '17:30' },
        { date: '2.7 (토)', time: '15:00' },  { date: '2.7 (토)', time: '17:30' },
        { date: '2.8 (일)', time: '15:00' },  { date: '2.8 (일)', time: '17:30' }
    ];

    let schedule = [];
    // Greedy placement to ensure no team plays twice on the same day
    for(let i=0; i<slots.length; i++) {
        const slotDate = slots[i].date;
        let bestPairIdx = 0;
        
        for(let j=0; j<pairs.length; j++) {
            const p = pairs[j];
            const hasPlayedToday = schedule.some(m => m.date === slotDate && (m.t1 === p.t1 || m.t2 === p.t1 || m.t1 === p.t2 || m.t2 === p.t2));
            if (!hasPlayedToday) {
                bestPairIdx = j;
                break;
            }
        }
        
        const selected = pairs.splice(bestPairIdx, 1)[0];
        schedule.push({
            ...slots[i],
            t1: selected.t1,
            t2: selected.t2,
            id: 'lcp_' + Date.now() + i,
            type: 'regular',
            format: 'BO3',
            status: 'pending'
        });
    }

    return schedule;
};

// [NEW] Updated Playoff Logic with your exact LCP dates!
export const generateLCPPlayoffs = (seeds) => {
    // [FIX] Use name if id doesn't exist
    const getSeedId = (s) => {
        const team = seeds.find(x => x.seed === s);
        return team ? (team.id || team.name) : null;
    };
    
    // 3rd Seed chooses opponent (90% chance to pick 6th)
    let pickOpponent = 6;
    if (Math.random() > 0.90) pickOpponent = 5;
    let otherOpponent = pickOpponent === 6 ? 5 : 6;

    return [
        { round: 1, match: 1, label: '플레이오프 1R', t1: getSeedId(3), t2: getSeedId(pickOpponent), date: '2.12 (목)', time: '15:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcp_po1' },
        { round: 1, match: 2, label: '플레이오프 1R', t1: getSeedId(4), t2: getSeedId(otherOpponent), date: '2.13 (금)', time: '15:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcp_po2' },
        { round: 2, match: 1, label: '승자조 2R', t1: getSeedId(1), t2: null, date: '2.14 (토)', time: '15:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcp_po3' },
        { round: 2, match: 2, label: '승자조 2R', t1: getSeedId(2), t2: null, date: '2.15 (일)', time: '15:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcp_po4' },
        { round: 3, match: 1, label: '승자조 결승', t1: null, t2: null, date: '2.26 (목)', time: '15:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcp_po5' },
        { round: 2.1, match: 1, label: '패자조 2R', t1: null, t2: null, date: '2.27 (금)', time: '15:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcp_po6' },
        { round: 3.1, match: 1, label: '결승 진출전', t1: null, t2: null, date: '2.28 (토)', time: '15:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcp_po7' },
        { round: 4, match: 1, label: '결승전', t1: null, t2: null, date: '3.1 (일)', time: '15:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcp_po8' }
    ];
};

// ==========================================
// [NEW] CBLOL SCHEDULE LOGIC
// ==========================================

export const generateCBLOLRegularSchedule = (teams) => {
    const getID = (t) => t.id || t.name;
    let teamIds = teams.map(getID);
    
    // Shuffle teams to randomize matchups
    teamIds = teamIds.sort(() => Math.random() - 0.5);

    // Generate 7 perfect Round-Robin rounds (4 games per round = 28 games total)
    const rounds = [];
    const n = teamIds.length; 
    let pool = [...teamIds];

    for (let r = 0; r < n - 1; r++) {
        const currentRound = [];
        for (let i = 0; i < n / 2; i++) {
            currentRound.push({ t1: pool[i], t2: pool[n - 1 - i] });
        }
        rounds.push(currentRound);
        // Rotate all teams except the first one
        pool = [pool[0], pool[n - 1], ...pool.slice(1, n - 1)];
    }

    // Flatten into 28 sequential matches
    const allMatches = rounds.flat();

    // Map exact dates and times per your requirements (BO1s)
    const slots = [
        // Week 1 (5 games/day)
        { date: '1.18 (일)', time: '01:00' }, { date: '1.18 (일)', time: '02:00' }, { date: '1.18 (일)', time: '03:00' }, { date: '1.18 (일)', time: '04:00' }, { date: '1.18 (일)', time: '05:00' },
        // Week 2 (5 games/day)
        { date: '1.19 (월)', time: '01:00' }, { date: '1.19 (월)', time: '02:00' }, { date: '1.19 (월)', time: '03:00' }, { date: '1.19 (월)', time: '04:00' }, { date: '1.19 (월)', time: '05:00' },
        { date: '1.25 (일)', time: '01:00' }, { date: '1.25 (일)', time: '02:00' }, { date: '1.25 (일)', time: '03:00' }, { date: '1.25 (일)', time: '04:00' }, { date: '1.25 (일)', time: '05:00' },
        { date: '1.26 (월)', time: '01:00' }, { date: '1.26 (월)', time: '02:00' }, { date: '1.26 (월)', time: '03:00' }, { date: '1.26 (월)', time: '04:00' }, { date: '1.26 (월)', time: '05:00' },
        // Week 3 (4 games/day)
        { date: '2.1 (일)', time: '01:00' }, { date: '2.1 (일)', time: '02:00' }, { date: '2.1 (일)', time: '03:00' }, { date: '2.1 (일)', time: '04:00' },
        { date: '2.2 (월)', time: '01:00' }, { date: '2.2 (월)', time: '02:00' }, { date: '2.2 (월)', time: '03:00' }, { date: '2.2 (월)', time: '04:00' }
    ];
    
    let schedule = [];
    for (let i = 0; i < 28; i++) {
        // Randomize Blue/Red Side
        const coin = Math.random() < 0.5;
        schedule.push({
            date: slots[i].date,
            time: slots[i].time,
            t1: coin ? allMatches[i].t1 : allMatches[i].t2,
            t2: coin ? allMatches[i].t2 : allMatches[i].t1,
            id: 'cblol_' + Date.now() + i,
            type: 'regular',
            format: 'BO1',
            status: 'pending'
        });
    }
    
    return schedule;
};

export const generateCBLOLPlayoffs = (seeds) => {
    const getSeedId = (s) => {
        const team = seeds.find(x => x.seed === s);
        return team ? (team.id || team.name) : null;
    };

    return [
        // --- PLAY-IN STAGE (Strictly 'playin' type so it avoids playoff stats) ---
        { round: 1, match: 1, label: '플레이인 G1', t1: getSeedId(7), t2: getSeedId(8), date: '2.3 (화)', time: '01:00', type: 'playin', format: 'BO3', status: 'pending', id: 'cblol_pi1' },
        { round: 1, match: 2, label: '플레이인 G2', t1: getSeedId(5), t2: getSeedId(6), date: '2.3 (화)', time: '04:00', type: 'playin', format: 'BO3', status: 'pending', id: 'cblol_pi2' },
        { round: 2, match: 1, label: '플레이인 최종', t1: null, t2: null, date: '2.4 (수)', time: '06:00', type: 'playin', format: 'BO3', status: 'pending', id: 'cblol_pi3' },

        // --- UPPER BRACKET (Type 'playoff') ---
        { round: 1, match: 1, label: '승자조 1R', t1: getSeedId(3), t2: null, date: '2.8 (일)', time: '01:00', type: 'playoff', format: 'BO3', status: 'pending', id: 'cblol_po1' },
        { round: 1, match: 2, label: '승자조 1R', t1: getSeedId(4), t2: null, date: '2.8 (일)', time: '04:00', type: 'playoff', format: 'BO3', status: 'pending', id: 'cblol_po2' },

        { round: 2, match: 1, label: '승자조 2R', t1: getSeedId(1), t2: null, date: '2.9 (월)', time: '01:00', type: 'playoff', format: 'BO3', status: 'pending', id: 'cblol_po3' },
        { round: 2, match: 2, label: '승자조 2R', t1: getSeedId(2), t2: null, date: '2.9 (월)', time: '04:00', type: 'playoff', format: 'BO3', status: 'pending', id: 'cblol_po4' },

        { round: 3, match: 1, label: '승자조 결승', t1: null, t2: null, date: '2.22 (일)', time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'cblol_po5' },

        // --- LOWER BRACKET (Type 'playoff') ---
        { round: 1.1, match: 1, label: '패자조 1R', t1: null, t2: null, date: '2.15 (일)', time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'cblol_po6' },
        
        { round: 2.1, match: 1, label: '패자조 2R', t1: null, t2: null, date: '2.16 (월)', time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'cblol_po7' },
        
        { round: 3.1, match: 1, label: '패자조 3R', t1: null, t2: null, date: '2.23 (월)', time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'cblol_po8' },
        
        { round: 4, match: 1, label: '결승 진출전', t1: null, t2: null, date: '3.1 (일)', time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'cblol_po9' },

        // --- GRAND FINAL (Type 'playoff') ---
        { round: 5, match: 1, label: '결승전', t1: null, t2: null, date: '3.2 (월)', time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'cblol_po10' }
    ];
};
// [NEW] LCS SCHEDULE LOGIC (Swiss Format)
// ==========================================

// Week 1: Random pairings, 1 game per team
// ==========================================
// [NEW] LCS SCHEDULE LOGIC (SWISS STAGE & PO)
// ==========================================

export const generateLCSRegularSchedule = (teams) => {
    const getID = (t) => t.id || t.name;
    let teamIds = teams.map(getID).sort(() => Math.random() - 0.5);

    let schedule = [];

    // --- Week 1: Round 1 (Random Draw) - BO3 ---
    const w1Slots = [
        { date: '1.25 (일)', time: '06:00' },
        { date: '1.25 (일)', time: '09:00' },
        { date: '1.26 (월)', time: '06:00' },
        { date: '1.26 (월)', time: '09:00' }
    ];
    for (let i = 0; i < 4; i++) {
        schedule.push({
            date: w1Slots[i].date, time: w1Slots[i].time,
            t1: teamIds[i * 2], t2: teamIds[i * 2 + 1],
            id: 'lcs_w1_' + (i + 1), type: 'regular', format: 'BO3', status: 'pending', 
            swissRound: 1
        });
    }

    // --- Week 2: Round 2 (1-0 vs 1-0, 0-1 vs 0-1) - BO3 ---
    const w2Slots = [
        { date: '2.1 (일)', time: '06:00', bracket: '1-0' },
        { date: '2.1 (일)', time: '09:00', bracket: '1-0' },
        { date: '2.2 (월)', time: '06:00', bracket: '0-1' },
        { date: '2.2 (월)', time: '09:00', bracket: '0-1' }
    ];
    for (let i = 0; i < 4; i++) {
        schedule.push({
            date: w2Slots[i].date, time: w2Slots[i].time,
            t1: null, t2: null, // Filled dynamically by the ScheduleTab Engine!
            id: 'lcs_w2_' + (i + 1), type: 'regular', format: 'BO3', status: 'pending',
            swissRound: 2, bracket: w2Slots[i].bracket
        });
    }

    // --- Week 3: Round 3 (2-0 vs 2-0, 1-1 vs 1-1, 0-2 vs 0-2) - BO3 ---
    const w3Slots = [
        { date: '2.8 (일)', time: '06:00', bracket: '2-0' },
        { date: '2.8 (일)', time: '09:00', bracket: '1-1' },
        { date: '2.9 (월)', time: '06:00', bracket: '1-1' },
        { date: '2.9 (월)', time: '09:00', bracket: '0-2' }
    ];
    for (let i = 0; i < 4; i++) {
        schedule.push({
            date: w3Slots[i].date, time: w3Slots[i].time,
            t1: null, t2: null, // Filled dynamically by the ScheduleTab Engine!
            id: 'lcs_w3_' + (i + 1), type: 'regular', format: 'BO3', status: 'pending',
            swissRound: 3, bracket: w3Slots[i].bracket
        });
    }

    return schedule;
};

export const generateLCSPlayoffs = (seeds) => {
    const getSeedId = (s) => {
        const team = seeds.find(x => x.seed === s);
        return team ? (team.id || team.name) : null;
    };

    return [
        // --- PLAY-IN STAGE (Type 'playin', BO1) ---
        { round: 0.1, match: 1, label: '플레이인', t1: getSeedId(6), t2: getSeedId(7), date: '2.9 (월)', time: '12:00', type: 'playin', format: 'BO1', status: 'pending', id: 'lcs_pi1' },

        // --- UPPER BRACKET (Type 'playoff', BO5) ---
        { round: 1, match: 1, label: '승자조 1R', t1: getSeedId(1), t2: null, date: '2.15 (일)', time: '06:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcs_po1' },
        { round: 1, match: 2, label: '승자조 1R', t1: getSeedId(2), t2: null, date: '2.16 (월)', time: '06:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcs_po2' },

        { round: 2, match: 1, label: '승자조 결승', t1: null, t2: null, date: '2.23 (월)', time: '06:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcs_po3' },

        // --- LOWER BRACKET (Type 'playoff', BO5) ---
        { round: 1.1, match: 1, label: '패자조 1R', t1: getSeedId(5), t2: null, date: '2.21 (토)', time: '06:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcs_po4' },
        { round: 1.1, match: 2, label: '패자조 1R', t1: null, t2: null, date: '2.22 (일)', time: '06:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcs_po5' },
        
        { round: 2.1, match: 1, label: '패자조 2R', t1: null, t2: null, date: '2.28 (토)', time: '06:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcs_po6' },
        
        { round: 3.1, match: 1, label: '결승 진출전', t1: null, t2: null, date: '3.1 (일)', time: '06:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcs_po7' },

        // --- GRAND FINAL (Type 'playoff', BO5) ---
        { round: 4, match: 1, label: '결승전', t1: null, t2: null, date: '3.2 (월)', time: '06:00', type: 'playoff', format: 'BO5', status: 'pending', id: 'lcs_po8' }
    ];
};

const generateRoundRobinPairs = (ids) => {
    const n = ids.length; // must be 12
    const arr = [...ids];
    const fixed = arr[0];
    const rotating = arr.slice(1); // 11 elements
    const rounds = [];

    for (let r = 0; r < n - 1; r++) {
        const round = [];
        round.push([fixed, rotating[0]]);
        for (let i = 1; i < n / 2; i++) {
            round.push([rotating[i], rotating[n - 1 - i]]);
        }
        rounds.push(round);
        // Rotate: last element moves to front
        rotating.unshift(rotating.pop());
    }
    return rounds; // 11 rounds × 6 matches = 66 matches
};

export const generateLECRegularSchedule = (teams) => {
    const ids = teams.map(t => t.id || t.name);
    // Shuffle so pairings are random each season
    const shuffled = [...ids].sort(() => Math.random() - 0.5);
    const rounds = generateRoundRobinPairs(shuffled); // 11 rounds

    // Day/time layout: 4 weeks, 6 slots per day at 01:00 / 01:45 / 02:30 / 03:15 / 04:00 / 04:45
    const times = ['01:00', '01:45', '02:30', '03:15', '04:00', '04:45'];
    const days = [
        '1.18 (일)', '1.19 (월)', '1.20 (화)', // Week 1 (3 days = rounds 1-3)
        '1.25 (일)', '1.26 (월)', '1.27 (화)', // Week 2 (3 days = rounds 4-6)
        '2.1 (일)',  '2.2 (월)',  '2.3 (화)',  // Week 3 (3 days = rounds 7-9)
        '2.8 (일)',  '2.9 (월)',                // Week 4 (2 days = rounds 10-11)
    ];

    const schedule = [];
    let matchCounter = 0;

    rounds.forEach((round, roundIdx) => {
        const day = days[roundIdx];
        round.forEach((pair, slotIdx) => {
            matchCounter++;
            schedule.push({
                id: `lec_r${matchCounter}`,
                t1: pair[0],
                t2: pair[1],
                date: day,
                time: times[slotIdx],
                type: 'regular',
                format: 'BO1',
                status: 'pending',
                round: roundIdx + 1,
            });
        });
    });

    return schedule;
};

export const generateLECPlayoffs = (seeds) => {
    const getSeed = (n) => {
        const t = seeds.find(x => x.seed === n);
        return t ? (t.id || t.name) : null;
    };

    // Seed 1 picks from {5,6,7,8}: 80% takes seed 8 (lowest), 20% takes seed 7
    // Seed 2 picks from remaining: 80% takes the lowest remaining
    // Seed 3 picks from remaining: 80% takes the lowest remaining
    // Seed 4 gets the last one
    const pool = [5, 6, 7, 8]; // seed numbers available for upper seeds to pick from
    const pickOpponent = (available) => {
        if (available.length === 1) return available[0];
        const sorted = [...available].sort((a, b) => b - a); // highest seed number = weakest
        return Math.random() < 0.80 ? sorted[0] : sorted[1];
    };

    const remaining = [...pool];
    const s1pick = pickOpponent(remaining);
    remaining.splice(remaining.indexOf(s1pick), 1);
    const s2pick = pickOpponent(remaining);
    remaining.splice(remaining.indexOf(s2pick), 1);
    const s3pick = pickOpponent(remaining);
    remaining.splice(remaining.indexOf(s3pick), 1);
    const s4pick = remaining[0];

    return [
        // ─── Upper Bracket Round 1 ─────────────────────────────────────────────
        { id: 'lec_po_ub1g1', label: '1라운드 승자조', t1: getSeed(1),    t2: getSeed(s1pick), date: '2.17 (화)', time: '00:45', type: 'playoff', format: 'BO3', status: 'pending', round: 1, match: 1 },
        { id: 'lec_po_ub1g2', label: '1라운드 승자조', t1: getSeed(2),    t2: getSeed(s2pick), date: '2.17 (화)', time: '02:30', type: 'playoff', format: 'BO3', status: 'pending', round: 1, match: 2 },
        { id: 'lec_po_ub1g3', label: '1라운드 승자조', t1: getSeed(3),    t2: getSeed(s3pick), date: '2.18 (수)', time: '00:45', type: 'playoff', format: 'BO3', status: 'pending', round: 1, match: 3 },
        { id: 'lec_po_ub1g4', label: '1라운드 승자조', t1: getSeed(4),    t2: getSeed(s4pick), date: '2.18 (수)', time: '02:30', type: 'playoff', format: 'BO3', status: 'pending', round: 1, match: 4 },

        // ─── Upper Bracket Round 2 ─────────────────────────────────────────────
        // g1 wins vs g4 wins, g2 wins vs g3 wins
        { id: 'lec_po_ub2g1', label: '2라운드 승자조', t1: null, t2: null, date: '2.21 (토)', time: '00:45', type: 'playoff', format: 'BO3', status: 'pending', round: 2, match: 1 },
        { id: 'lec_po_ub2g2', label: '2라운드 승자조', t1: null, t2: null, date: '2.21 (토)', time: '02:30', type: 'playoff', format: 'BO3', status: 'pending', round: 2, match: 2 },

        // ─── Lower Bracket Round 1 ─────────────────────────────────────────────
        // g1 loser vs g4 loser, g2 loser vs g3 loser
        { id: 'lec_po_lb1g1', label: '1라운드 패자조', t1: null, t2: null, date: '2.22 (일)', time: '00:45', type: 'playoff', format: 'BO3', status: 'pending', round: 1.1, match: 1 },
        { id: 'lec_po_lb1g2', label: '1라운드 패자조', t1: null, t2: null, date: '2.22 (일)', time: '02:30', type: 'playoff', format: 'BO3', status: 'pending', round: 1.1, match: 2 },

        // ─── Lower Bracket Round 2 ─────────────────────────────────────────────
        // lb1g1 winner vs ub2g2 loser, lb1g2 winner vs ub2g1 loser
        { id: 'lec_po_lb2g1', label: '2라운드 패자조', t1: null, t2: null, date: '2.23 (월)', time: '00:45', type: 'playoff', format: 'BO3', status: 'pending', round: 2.1, match: 1 },
        { id: 'lec_po_lb2g2', label: '2라운드 패자조', t1: null, t2: null, date: '2.23 (월)', time: '02:30', type: 'playoff', format: 'BO3', status: 'pending', round: 2.1, match: 2 },

        // ─── Upper Final (3라운드 승자조) ─────────────────────────────────────
        // ub2g1 winner vs ub2g2 winner
        { id: 'lec_po_ubf',   label: '3라운드 승자조', t1: null, t2: null, date: '2.24 (화)', time: '00:45', type: 'playoff', format: 'BO5', status: 'pending', round: 3, match: 1 },

        // ─── Lower Semifinal (3라운드 패자조) ─────────────────────────────────
        // lb2g1 winner vs lb2g2 winner
        { id: 'lec_po_lbsf',  label: '3라운드 패자조', t1: null, t2: null, date: '2.28 (토)', time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', round: 3.1, match: 1 },

        // ─── 4라운드 ──────────────────────────────────────────────────────────
        // lbsf winner vs ubf loser
        { id: 'lec_po_r4',    label: '4라운드',         t1: null, t2: null, date: '3.1 (일)',  time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', round: 4, match: 1 },

        // ─── 결승 ─────────────────────────────────────────────────────────────
        // r4 winner vs ubf winner
        { id: 'lec_po_final', label: '결승전',           t1: null, t2: null, date: '3.2 (월)',  time: '01:00', type: 'playoff', format: 'BO5', status: 'pending', round: 5, match: 1 },
    ];
};






