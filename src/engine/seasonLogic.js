// src/engine/seasonLogic.js
import { championList } from '../data/constants';

// [NEW] Logic to update champion tiers (Meta Shift)
// This simulates the meta changing between seasons.
export const updateChampionMeta = (currentChamps) => {
    // Probabilities for shifting tiers
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
        const chances = probabilities[tierNum];
        const order = [1, 2, 3, 4, 5];
        
        for (const t of order) {
            if (chances[t] !== undefined) {
                cumulative += chances[t];
                if (rand < cumulative) return t;
            }
        }
        return tierNum; 
    };

    const sourceList = (currentChamps && currentChamps.length > 0) ? currentChamps : championList;
    
    return sourceList.map(champ => {
        let newTier = getNewTier(champ.tier);
        return { ...champ, tier: newTier };
    });
};

// [NEW] Logic to generate Super Week matches separately if needed
export const generateSuperWeekMatches = (league) => {
    const existingSuperMatches = league.matches ? league.matches.filter(m => m.type === 'super') : [];
    
    // If matches already exist, don't generate new ones
    if (existingSuperMatches.length > 0) return [];

    const baronDraftOrder = league.groups?.baron || []; 
    const elderDraftOrder = league.groups?.elder || [];
    
    let newMatches = [];
    const days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)']; 

    let pairs = [];
    for(let i=0; i<5; i++) {
        if (baronDraftOrder[i] && elderDraftOrder[i]) {
            pairs.push({ 
                t1: baronDraftOrder[i], 
                t2: elderDraftOrder[i] 
            });
        }
    }
    
    pairs.sort(() => Math.random() - 0.5); // Shuffle

    pairs.forEach((pair, idx) => {
        newMatches.push({
            id: Date.now() + idx + 5000, // Safe ID offset
            t1: pair.t1,
            t2: pair.t2,
            date: days[idx] || '2.1 (일)', 
            time: '17:00',
            type: 'super', 
            format: 'BO5', 
            status: 'pending'
        });
    });

    return newMatches;
};