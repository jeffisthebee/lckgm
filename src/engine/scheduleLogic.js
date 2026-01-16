// src/engine/scheduleLogic.js

export const generateSchedule = (baronIds, elderIds) => {
    // LCK Cup Format: 2 Weeks of Regular Season (4 games) + 1 Super Week (1 game)
    const regularDays = [
        '1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)', 
        '1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'
    ];
    // Super Week days (adjust dates as needed)
    const superDays = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)'];

    // Restore Draft Order if inputs are Team Objects
    const restoreOrder = (group) => {
        if (group.length > 0 && typeof group[0] === 'object') {
            return [...group].sort((a, b) => (a.draftOrder ?? a.id) - (b.draftOrder ?? b.id));
        }
        return group; // If strings/IDs, assume they are passed in correct order or can't sort
    };

    const baronList = restoreOrder(baronIds);
    const elderList = restoreOrder(elderIds);

    const allMatches = [];
    const n = 5; 
    
    // Track Blue Side counts
    const teamBlueCounts = {};
    const getId = (t) => (typeof t === 'object' ? t.id : t);
    [...baronList, ...elderList].forEach(t => teamBlueCounts[getId(t)] = 0);
    
    // Track Group Totals to enforce 12/13 split
    let baronGroupBlueTotal = 0;
    let elderGroupBlueTotal = 0;

    // We generate 5 rounds total
    for (let r = 0; r < 5; r++) {
        const isSuperWeek = (r === 4);
        const offset = isSuperWeek ? 0 : (r + 1);

        for (let i = 0; i < n; i++) {
            const b = baronList[i];
            const e = elderList[(i + offset) % n];
            
            let t1, t2; // t1 is Blue, t2 is Red

            // --- Side Selection Logic (Strict Fairness) ---
            const bId = getId(b);
            const eId = getId(e);
            const bBlue = teamBlueCounts[bId];
            const eBlue = teamBlueCounts[eId];
            
            // Priority 1: Enforce "At least 2 Blue Games" per team
            if (bBlue < 2 && eBlue >= 2) {
                t1 = b; t2 = e;
            } else if (eBlue < 2 && bBlue >= 2) {
                t1 = e; t2 = b;
            } 
            // Priority 2: Enforce Group Balance (12 vs 13 split)
            else if (baronGroupBlueTotal < elderGroupBlueTotal) {
                t1 = b; t2 = e;
            } else if (elderGroupBlueTotal < baronGroupBlueTotal) {
                t1 = e; t2 = b;
            } 
            // Priority 3: Random
            else {
                if (Math.random() < 0.5) { t1 = b; t2 = e; } 
                else { t1 = e; t2 = b; }
            }
            
            // Update Counts
            const t1Id = getId(t1);
            teamBlueCounts[t1Id]++;
            
            // Check which group t1 belongs to (using original list inclusion)
            if (baronList.includes(t1)) baronGroupBlueTotal++;
            else elderGroupBlueTotal++;

            allMatches.push({
                id: Date.now() + allMatches.length + (r * 100),
                t1: t1,
                t2: t2,
                type: isSuperWeek ? 'super' : 'regular',
                status: 'pending',
                format: isSuperWeek ? 'BO5' : 'BO3',
                label: isSuperWeek ? '🔥 슈퍼위크' : '정규시즌',
                roundIndex: r
            });
        }
    }

    // 2. Separate Matches
    const regularMatches = allMatches.filter(m => m.type === 'regular'); 
    const superMatches = allMatches.filter(m => m.type === 'super');

    // Schedule the 20 Regular Season matches into the 10 days
    let finalRegularSchedule = [];
    
    // Attempt to schedule regular matches fairly
    for (let attempt = 0; attempt < 5000; attempt++) {
        const queue = [...regularMatches].sort(() => Math.random() - 0.5);
        const slots = Array(10).fill(null).map(() => []); 
        const teamDays = {};
        [...baronList, ...elderList].forEach(t => teamDays[getId(t)] = new Set());
        
        let possible = true;

        for (const match of queue) {
            const t1Id = getId(match.t1);
            const t2Id = getId(match.t2);

            const validDayIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(d => {
                if (slots[d].length >= 2) return false;
                if (teamDays[t1Id].has(d) || teamDays[t2Id].has(d)) return false;

                // Back-to-Back Check
                const checkNeighbor = (teamId, day) => {
                    if (day > 0 && day !== 5) { if (teamDays[teamId].has(day - 1)) return false; }
                    if (day < 9 && day !== 4) { if (teamDays[teamId].has(day + 1)) return false; }
                    return true;
                };
                if (!checkNeighbor(t1Id, d)) return false;
                if (!checkNeighbor(t2Id, d)) return false;

                return true;
            });

            if (validDayIndices.length === 0) { possible = false; break; }
            
            const pick = validDayIndices[Math.floor(Math.random() * validDayIndices.length)];
            slots[pick].push(match);
            teamDays[t1Id].add(pick);
            teamDays[t2Id].add(pick);
        }

        if (possible) {
            slots.forEach((dayMatches, dIdx) => {
                dayMatches.forEach((m, mIdx) => {
                    finalRegularSchedule.push({
                        ...m,
                        date: regularDays[dIdx],
                        time: mIdx === 0 ? '17:00' : '19:30'
                    });
                });
            });
            break; 
        }
    }

    // Fallback if scheduling failed
    if (finalRegularSchedule.length === 0) {
        finalRegularSchedule = regularMatches.map((m, i) => ({
            ...m,
            date: regularDays[Math.floor(i / 2)] || 'TBD',
            time: i % 2 === 0 ? '17:00' : '19:30'
        }));
    }

    // Process Super Week Matches (Assign dates)
    const superMatchesScheduled = superMatches.sort(() => Math.random() - 0.5).map((m, i) => ({
        ...m,
        date: superDays[i] || '2.1 (일)',
        time: '17:00' // Super Week usually 1 match per day
    }));

    // Return Combined Schedule (Regular + Super)
    const fullSchedule = [...finalRegularSchedule, ...superMatchesScheduled];

    return fullSchedule.sort((a, b) => {
        const dateA = a.date.split(' ')[0];
        const dateB = b.date.split(' ')[0];
        return parseFloat(dateA) - parseFloat(dateB) || (a.time > b.time ? 1 : -1);
    });
};