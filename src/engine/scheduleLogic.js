// src/engine/scheduleLogic.js

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

// --- BACKTRACKING SCHEDULER ---
// This ensures strict adherence to "No Back-to-Back" constraints
const solveWeekSchedule = (matches, days, slotsPerDay) => {
    // We try multiple attempts with shuffled inputs to find a valid solution
    for (let attempt = 0; attempt < 50; attempt++) {
        const pool = shuffle([...matches]);
        
        // Data Structures
        const schedule = Array(days.length).fill(null).map(() => []); // [ [Match, Match], [], ... ]
        const teamActivity = {}; // { teamId: { dayIdx: boolean } }

        if (runBacktrack(0, pool, schedule, teamActivity, slotsPerDay, days.length)) {
            // Solution Found -> Format it
            const result = [];
            schedule.forEach((dayMatches, dayIdx) => {
                dayMatches.forEach((m, slotIdx) => {
                    result.push({
                        ...m,
                        date: days[dayIdx],
                        time: slotIdx === 0 ? '17:00' : '19:30' // Standard LCK Times
                    });
                });
            });
            return result;
        }
    }
    
    console.warn("Could not find perfect schedule, falling back to simple distribution");
    return fallbackSchedule(matches, days, slotsPerDay);
};

const runBacktrack = (matchIdx, pool, schedule, teamActivity, slotsPerDay, numDays) => {
    // Base Case: All matches placed
    if (matchIdx === pool.length) return true;

    const match = pool[matchIdx];
    const t1 = match.t1;
    const t2 = match.t2;

    // Try to place this match on any of the days
    // Optimization: Try days with fewer matches first to balance load? 
    // For now, simple iteration 0..4 is fine for N=10 matches
    for (let day = 0; day < numDays; day++) {
        
        // Constraint 1: Slot Capacity
        if (schedule[day].length >= slotsPerDay) continue;

        // Constraint 2: Teams cannot play twice on the same day
        if (hasPlayedOnDay(t1, day, teamActivity) || hasPlayedOnDay(t2, day, teamActivity)) continue;

        // Constraint 3: NO BACK-TO-BACK (Cannot play on Day-1 or Day+1)
        if (hasPlayedOnDay(t1, day - 1, teamActivity) || hasPlayedOnDay(t1, day + 1, teamActivity)) continue;
        if (hasPlayedOnDay(t2, day - 1, teamActivity) || hasPlayedOnDay(t2, day + 1, teamActivity)) continue;

        // Action: Place Match
        schedule[day].push(match);
        setPlayed(t1, day, true, teamActivity);
        setPlayed(t2, day, true, teamActivity);

        // Recurse
        if (runBacktrack(matchIdx + 1, pool, schedule, teamActivity, slotsPerDay, numDays)) {
            return true;
        }

        // Backtrack: Undo Action
        schedule[day].pop();
        setPlayed(t1, day, false, teamActivity);
        setPlayed(t2, day, false, teamActivity);
    }

    return false;
};

// --- ACTIVITY HELPERS ---
const hasPlayedOnDay = (teamId, dayIdx, activityMap) => {
    if (dayIdx < 0) return false;
    if (!activityMap[teamId]) return false;
    return !!activityMap[teamId][dayIdx];
};

const setPlayed = (teamId, dayIdx, status, activityMap) => {
    if (!activityMap[teamId]) activityMap[teamId] = {};
    if (status) activityMap[teamId][dayIdx] = true;
    else delete activityMap[teamId][dayIdx];
};

const fallbackSchedule = (matches, days, slotsPerDay) => {
    // Simple dump if solver fails (should be rare)
    return matches.map((m, i) => ({
        ...m,
        date: days[Math.floor(i / slotsPerDay)] || days[days.length - 1],
        time: '17:00'
    }));
};


// --- MAIN GENERATOR ---
export const generateSchedule = (baronIds, elderIds) => {
    // 1. Normalize IDs
    const getID = (t) => (typeof t === 'object' ? t.id : t);
    const barons = baronIds.map(getID);
    const elders = elderIds.map(getID);
    const allTeamIds = [...barons, ...elders];

    // 2. Generate 5 Perfect Matchings (K5,5 Decomposition)
    // Ensures every Baron plays every Elder exactly once.
    const matchings = []; 
    const shuffledElders = shuffle([...elders]);
    const shuffledBarons = shuffle([...barons]); 

    for (let offset = 0; offset < 5; offset++) {
        const roundMatches = [];
        for (let i = 0; i < 5; i++) {
            roundMatches.push({
                t1: shuffledBarons[i],
                t2: shuffledElders[(i + offset) % 5]
            });
        }
        matchings.push(roundMatches);
    }

    const shuffledMatchings = shuffle(matchings);

    // 3. Assign Rounds to Weeks
    // Week 1: 2 Rounds (10 Matches)
    const week1Pool = [...shuffledMatchings[0], ...shuffledMatchings[1]];
    // Week 2: 2 Rounds (10 Matches)
    const week2Pool = [...shuffledMatchings[2], ...shuffledMatchings[3]];
    // Week 3 (Super Week): 1 Round (5 Matches)
    const superWeekPool = [...shuffledMatchings[4]];

    // 4. Solve Dates for Each Week
    const regularDays1 = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
    const regularDays2 = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
    const superDays = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)']; 

    const scheduleW1 = solveWeekSchedule(week1Pool, regularDays1, 2);
    const scheduleW2 = solveWeekSchedule(week2Pool, regularDays2, 2);
    
    // Super week is easier (1 match per day), solver works or simple map works
    // Use solver to ensure random valid distribution
    const scheduleSuper = solveWeekSchedule(superWeekPool, superDays, 1);

    let allScheduled = [...scheduleW1, ...scheduleW2, ...scheduleSuper];

    // 5. Side Selection & Balancing
    // Constraint: Every team must play minimum 2 games on Blue Side (out of 5 total).
    
    // A. Initial Random Assignment
    allScheduled = allScheduled.map(m => {
        const coin = Math.random() < 0.5;
        return {
            ...m,
            t1: coin ? m.t1 : m.t2, // New t1 is Blue
            t2: coin ? m.t2 : m.t1, // New t2 is Red
            blueSidePriority: 'coin'
        };
    });

    // B. Balance Loop
    const getBlueCounts = (matches) => {
        const counts = {};
        allTeamIds.forEach(id => counts[id] = 0);
        matches.forEach(m => {
            counts[m.t1] = (counts[m.t1] || 0) + 1;
        });
        return counts;
    };

    let counts = getBlueCounts(allScheduled);
    let safety = 0;

    while (safety < 1000) {
        // Find a team with < 2 Blue Sides
        const unluckyTeam = allTeamIds.find(id => counts[id] < 2);
        
        if (!unluckyTeam) break; // All balanced!

        // Find a match where this team is Red (t2)
        // AND the opponent (t1) has > 2 Blue Sides (so taking one away is fine)
        const candidates = allScheduled.filter(m => 
            String(m.t2) === String(unluckyTeam) && counts[m.t1] > 2
        );

        if (candidates.length > 0) {
            // Pick random candidate or first
            const swapMatch = candidates[0];
            
            // Swap
            const temp = swapMatch.t1;
            swapMatch.t1 = swapMatch.t2;
            swapMatch.t2 = temp;

            // Update Counts
            counts = getBlueCounts(allScheduled);
        } else {
            // If no perfect swap exists, just swap against anyone to force the constraint
            // (Even if it drops opponent to 1, subsequent loops will fix them)
            const forceCandidates = allScheduled.filter(m => String(m.t2) === String(unluckyTeam));
            if (forceCandidates.length > 0) {
                const swapMatch = forceCandidates[0];
                const temp = swapMatch.t1;
                swapMatch.t1 = swapMatch.t2;
                swapMatch.t2 = temp;
                counts = getBlueCounts(allScheduled);
            } else {
                break; // Should not happen
            }
        }
        safety++;
    }

    // 6. Final Formatting
    allScheduled = allScheduled.map(m => {
        const isSuper = superDays.includes(m.date);
        return {
            ...m,
            id: Date.now() + Math.floor(Math.random()*1000000), 
            type: isSuper ? 'super' : 'regular',
            format: isSuper ? 'BO5' : 'BO3', // Super week is BO5? Or regular is BO3?
            status: 'pending'
        };
    });

    // Sort Chronologically
    const parseDate = (d) => {
        if (!d) return 99999;
        const parts = d.split(' ')[0].split('.');
        return parseInt(parts[0])*100 + parseInt(parts[1]);
    };
    
    allScheduled.sort((a,b) => {
        const da = parseDate(a.date);
        const db = parseDate(b.date);
        if (da !== db) return da - db;
        return a.time.localeCompare(b.time);
    });

    return allScheduled;
};