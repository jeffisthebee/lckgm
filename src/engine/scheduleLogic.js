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
            t1: coin ? m.t1 : m.t2, 
            t2: coin ? m.t2 : m.t1,
            blueSidePriority: 'coin'
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