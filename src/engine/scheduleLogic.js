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

export const generateSchedule = (baronIds, elderIds) => {
    // 1. Data Prep: Ensure we have IDs (handle team objects if passed)
    const getID = (t) => (typeof t === 'object' ? t.id : t);
    const barons = baronIds.map(getID);
    const elders = elderIds.map(getID);

    // 2. Generate 5 Perfect Matchings (Decomposition of K5,5 Graph)
    // We create 5 rounds where in each round, every team plays exactly once against a unique opponent.
    const matchings = []; 
    
    // Shuffle elders relative to barons to ensure unique random pairings every season
    const shuffledElders = shuffle([...elders]);
    const shuffledBarons = shuffle([...barons]); 

    for (let offset = 0; offset < 5; offset++) {
        const roundMatches = [];
        for (let i = 0; i < 5; i++) {
            const baron = shuffledBarons[i];
            const elder = shuffledElders[(i + offset) % 5];
            
            roundMatches.push({
                t1: baron,
                t2: elder,
                // Side will be balanced later
            });
        }
        matchings.push(roundMatches);
    }

    // 3. Assign Matchings to Weeks (Even Distribution)
    // We shuffle the order of the matchings (rounds) so the "Super Week" matchups aren't predictable.
    const shuffledMatchings = shuffle(matchings);

    // Week 1: 2 Rounds (Everyone plays 2 games)
    const week1Matches = [...shuffledMatchings[0], ...shuffledMatchings[1]];
    // Week 2: 2 Rounds (Everyone plays 2 games)
    const week2Matches = [...shuffledMatchings[2], ...shuffledMatchings[3]];
    // Week 3 (Super Week): 1 Round (Everyone plays 1 game)
    const superWeekMatches = [...shuffledMatchings[4]];

    // 4. Daily Scheduling Helper
    const scheduleWeek = (matches, days, matchesPerDay) => {
        // We attempt to fit matches into days such that no team plays twice in one day.
        let bestSchedule = null;
        
        // Try multiple times to find a valid conflict-free schedule
        for(let attempt=0; attempt<50; attempt++) {
            const dailySlots = Array(days.length).fill().map(() => []);
            const pool = shuffle([...matches]);
            let valid = true;

            for(const match of pool) {
                // Find days that are not full AND have no team conflicts
                const validDays = [];
                for(let d=0; d<days.length; d++) {
                    if (dailySlots[d].length >= matchesPerDay) continue;
                    
                    const busy = dailySlots[d].some(m => m.t1 === match.t1 || m.t2 === match.t1 || m.t1 === match.t2 || m.t2 === match.t2);
                    if (!busy) validDays.push(d);
                }

                if (validDays.length === 0) {
                    valid = false;
                    break;
                }

                // Pick a random valid day
                const pickedDay = validDays[Math.floor(Math.random() * validDays.length)];
                dailySlots[pickedDay].push(match);
            }

            if (valid) {
                bestSchedule = dailySlots;
                break;
            }
        }
        
        // Flatten into a final list
        const result = [];
        if (bestSchedule) {
            bestSchedule.forEach((dayMatches, dayIdx) => {
                dayMatches.forEach((m, idx) => {
                    result.push({
                        ...m,
                        date: days[dayIdx],
                        time: idx === 0 ? '17:00' : '19:30'
                    });
                });
            });
        } else {
            // Fallback (Rare): Just dump them in order if logic fails
            matches.forEach((m, i) => {
                result.push({ ...m, date: days[Math.floor(i/matchesPerDay)] || days[0], time: '17:00' });
            });
        }
        return result;
    };

    const regularDays1 = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
    const regularDays2 = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
    const superDays = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)']; 

    const w1Final = scheduleWeek(week1Matches, regularDays1, 2); // 2 matches per day
    const w2Final = scheduleWeek(week2Matches, regularDays2, 2);
    const superFinal = scheduleWeek(superWeekMatches, superDays, 1); // 1 match per day

    let allScheduled = [...w1Final, ...w2Final, ...superFinal];

    // 5. Side Selection (Balance Constraint)
    // Goal: Every team must play at least 2 Blue Side games out of their 5 total games.
    
    // Step A: Randomly assign sides initially
    allScheduled = allScheduled.map(m => {
        const coin = Math.random() < 0.5;
        return {
            ...m,
            t1: coin ? m.t1 : m.t2, // t1 is Blue
            t2: coin ? m.t2 : m.t1, // t2 is Red
            blueSidePriority: 'coin' 
        };
    });

    // Step B: Balancing Loop
    const getBlueCounts = (matches) => {
        const counts = {};
        [...barons, ...elders].forEach(id => counts[id] = 0);
        matches.forEach(m => {
            counts[m.t1] = (counts[m.t1] || 0) + 1;
        });
        return counts;
    };

    let counts = getBlueCounts(allScheduled);
    let iterations = 0;

    // Keep swapping until everyone has >= 2 Blue games
    while (iterations < 1000) {
        // Find a team with < 2 Blue sides
        const deficitTeam = Object.keys(counts).find(id => counts[id] < 2);
        
        if (!deficitTeam) break; // All good!

        // Find a match where this deficit team is Red (t2)
        // We prioritize swapping against an opponent who has 'extra' Blue sides (>2)
        const candidateMatches = allScheduled.filter(m => String(m.t2) === String(deficitTeam));
        
        if (candidateMatches.length > 0) {
            // Sort by opponent's blue count (descending) to take from the rich
            candidateMatches.sort((a,b) => counts[b.t1] - counts[a.t1]);
            
            const matchToSwap = candidateMatches[0];
            
            // Swap sides
            const temp = matchToSwap.t1;
            matchToSwap.t1 = matchToSwap.t2;
            matchToSwap.t2 = temp;
            
            // Recalculate counts
            counts = getBlueCounts(allScheduled);
        } else {
            break; // Should mathematically not happen with 5 games
        }
        iterations++;
    }

    // 6. Final Polish (Add IDs, Type, Format)
    allScheduled = allScheduled.map(m => {
        const isSuper = superDays.includes(m.date);
        return {
            ...m,
            id: Date.now() + Math.floor(Math.random()*100000), 
            type: isSuper ? 'super' : 'regular',
            format: isSuper ? 'BO5' : 'BO3',
            status: 'pending'
        };
    });

    // Sort by Date/Time
    const parseDate = (d) => {
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