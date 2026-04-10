// src/components/ScheduleTab.jsx
import React, { useState, useEffect } from 'react';
import { quickSimulateMatch } from '../engine/simEngine';
import { 
    generateLCPRegularSchedule, generateLCPPlayoffs, 
    generateCBLOLRegularSchedule, generateCBLOLPlayoffs,
    generateLCSRegularSchedule, generateLCSPlayoffs,
    generateLECRegularSchedule, generateLECPlayoffs,
    generateLPLRegularSchedule, generateLPLPlayoffs
} from '../engine/scheduleLogic';
import { FOREIGN_LEAGUES, FOREIGN_PLAYERS } from '../data/foreignLeagues';
import playersLCK from '../data/players.json';
import { updateLeague } from '../engine/storage';
import { championList } from '../data/constants'; 

const compareDatesObj = (a, b) => {
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

const findGlobalTeam = (token, teamsList) => {
    if (!token || token === 'TBD' || token === 'null' || token === 'undefined') return { name: 'TBD' };
    const s = String(token).trim().toUpperCase();
    const pool = [...(teamsList || []), ...Object.values(FOREIGN_LEAGUES).flat()];
    const found = pool.find(t =>
        (t.id && String(t.id).toUpperCase() === s) ||
        (t.name && String(t.name).toUpperCase() === s) ||
        (t.fullName && String(t.fullName).toUpperCase() === s)
    );
    return found || { name: String(token) };
};


// --- HELPER: Recalculate POG scores on stored match history using the current formula ---
// Always recalculates from the actual end-of-game stats so both manual and CPU games
// use the same scoring. Runs at display time so saved data is never mutated.
const recalcPogForMatch = (match) => {
    if (!match?.result?.history) return match;
    const newHistory = match.result.history.map(set => {
        const allSidePicks = { A: set.picks?.A || [], B: set.picks?.B || [] };
        const newPicks = {};
        ['A', 'B'].forEach(side => {
            newPicks[side] = allSidePicks[side].map(p => {
                const k = p.stats?.kills ?? p.k ?? 0;
                const d = p.stats?.deaths ?? p.d ?? 0;
                const a = p.stats?.assists ?? p.a ?? 0;
                const gold = p.currentGold ?? 0;
                const kda = (k * 3 + a * 0.25) / Math.max(d, 1.5);
                let pogScore = 65 + kda + (gold / 1500);
                const role = p.playerData?.포지션 || p.role || 'MID';
                if (['SUP', '서포터'].includes(role)) pogScore += Math.max(10 - (d * 1.5), 2);
                if (['JGL', '정글'].includes(role))   pogScore += Math.max(6 - d, 0);
                if (['TOP', '탑'].includes(role))     pogScore += Math.max(4 - d, 0);
                return { ...p, pogScore };
            });
        });
        // Re-elect POG winner from whichever side won this set
        const winnerName = set.winner || set.winnerName;
        const sideATeam = newPicks.A[0]?.playerData?.팀 || '';
        const winnerSideKey = (sideATeam && winnerName && (sideATeam === winnerName || winnerName.includes(sideATeam) || sideATeam.includes(winnerName))) ? 'A' : 'B';
        const winningPicks = newPicks[winnerSideKey];
        const newPogPlayer = winningPicks.length > 0
            ? [...winningPicks].sort((a, b) => (b.pogScore || 0) - (a.pogScore || 0))[0]
            : set.pogPlayer;
        return { ...set, picks: newPicks, pogPlayer: newPogPlayer };
    });
    return { ...match, result: { ...match.result, history: newHistory } };
};

const getSafeRoster = (teamObj, allPlayers) => {
    const tName = teamObj.name;
    let r = allPlayers.filter(p => p.팀 === tName || p.team === tName || p.Team === tName || (p.playerData && p.playerData.팀 === tName));
    const requiredRoles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    return requiredRoles.map(role => {
        const existing = r.find(p => String(p.포지션 || p.role).toUpperCase() === role);
        if (existing) {
            return {
                ...existing,
                이름: existing.이름 || existing.playerName || `${tName} ${role}`,
                playerName: existing.playerName || existing.이름 || `${tName} ${role}`,
                상세: existing.상세 || { 라인전: 80, 한타: 80, 운영: 80, 생존: 80, 성장: 80, 무력: 80 },
                종합: existing.종합 || existing.ovr || 80,
                playerData: existing.playerData || { 팀: tName, 포지션: role }
            };
        }
        return {
            이름: `${tName} ${role}`, playerName: `${tName} ${role}`,
            포지션: role, role: role, 팀: tName, 종합: 80,
            상세: { 라인전: 80, 한타: 80, 운영: 80, 생존: 80, 성장: 80, 무력: 80 },
            playerData: { 팀: tName, 포지션: role }
        };
    });
};

const ScheduleTab = ({ activeTab, league, setLeague, teams, myTeam, myLeague: myLeagueProp, hasDrafted, formatTeamName, onMatchClick, onFSTSimulate }) => {
    const myLeague = myLeagueProp || 'LCK';
    const isMyLeagueForeign = myLeague !== 'LCK';

    const [currentLeague, setCurrentLeague] = useState(myLeague);
    // team_schedule always shows the user's own league schedule
    const displayLeague = activeTab === 'team_schedule' ? myLeague : currentLeague;

    // FST data
    const fstMatches = league?.fst?.matches || [];
    const fstTeams = league?.fst?.teams || [];
    const hasFST = !!league?.fst;

    // Check if myTeam is in FST
    const myFSTTeam = fstTeams.find(t => t.name === myTeam?.name || t.name === myTeam?.fullName);
    const showFSTInTeamSchedule = activeTab === 'team_schedule' && hasFST && !!myFSTTeam;

    const [forceRegen, setForceRegen] = useState(false);
    const [syncDone, setSyncDone] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null); // null = show all

    // LCK has two sub-views: 'cup' (regular season) and 'split1' (Split 1)
    // Default to split1 when it exists, otherwise cup
    const hasLCKSplit1Matches = (league?.matches || []).some(m => m.type === 'lck_split1_regular');
    const hasLCKCupMatches    = (league?.matches || []).some(m => m.type === 'regular' || m.type === 'super' || m.type === 'playoff' || m.type === 'playin');
    const [lckView, setLckView] = useState(hasLCKSplit1Matches ? 'split1' : 'cup');

    // Keep lckView in sync if split1 is added after initial render
    useEffect(() => {
        if (hasLCKSplit1Matches && lckView === 'cup' && !hasLCKCupMatches) setLckView('split1');
        if (!hasLCKSplit1Matches) setLckView('cup');
    }, [hasLCKSplit1Matches, hasLCKCupMatches]);

    const targetLeague = ['LPL', 'LCP', 'CBLOL', 'LCS', 'LEC'].includes(displayLeague) ? displayLeague : null;

    // Reset sync completion whenever the viewed league changes so it re-evaluates
    useEffect(() => { setSyncDone(false); setSelectedTeam(null); }, [targetLeague, displayLeague]);

    const rawLCKMatches = league.matches || [];
    const activeMatches = displayLeague === 'LCK'
        ? (lckView === 'split1'
            ? rawLCKMatches.filter(m => m.type === 'lck_split1_regular')
            : rawLCKMatches.filter(m => m.type !== 'lck_split1_regular'))
        : (league.foreignMatches?.[displayLeague] || []);
    const pendingLCK = league.matches ? league.matches.filter(m => m.status === 'pending').sort(compareDatesObj) : [];
    const lckPlayoffMatches = league.matches?.filter(m => m.type === 'playoff') || [];
    const lckTrulyDone = lckPlayoffMatches.length > 0 && lckPlayoffMatches.every(m => m.status === 'finished');

    // The "gate" controls how far other leagues can be auto-simmed.
    // For foreign players: gate = their OWN league's next pending match.
    // When their schedule isn't ready yet, use date '0.01' (before all real dates)
    // so compareDatesObj(anyRealMatch, gate) >= 0 → all matches blocked.
    const currentPendingLCK = (() => {
        if (isMyLeagueForeign) {
            const myLeagueMatches = league.foreignMatches?.[myLeague] || [];
            const myPending = [...myLeagueMatches].filter(m => m.status === 'pending').sort(compareDatesObj);
            // Only truly done when ALL matches (regular + playoffs) are finished
            const myAllDone = myLeagueMatches.length > 0 && myLeagueMatches.every(m => m.status === 'finished');
            if (myPending.length > 0) return myPending[0];
            if (myAllDone) return { date: '99.99 (완료)', time: '23:59' };
            // Regular season done but no playoffs yet, or season not started —
            // use the last finished match date so same-day other-league games can still sim,
            // but we don't blast all other leagues with '99.99'
            const lastFinished = [...myLeagueMatches]
                .filter(m => m.status === 'finished')
                .sort((a, b) => -compareDatesObj(a, b))[0];
            if (lastFinished) return { ...lastFinished, _isLastFinished: true };
            return { date: '0.01', time: '00:00' }; // not started yet
        }
        if (pendingLCK.length > 0) return pendingLCK[0];
        if (lckTrulyDone) return { date: '99.99 (완료)', time: '23:59' };
        return { date: '12.31', time: '23:59' };
    })();
    
    const checkBadData = (matches, lg) => matches.some(m => {
        if (lg === 'CBLOL' && (m.type === 'regular' || m.type === 'super') && m.format !== 'BO1') return true;
        if (lg === 'LEC' && m.type === 'regular' && m.format !== 'BO1') return true;

        const t1Str = String(m.t1); const t2Str = String(m.t2);
        
        if (m.t1 && m.t2 && t1Str !== 'TBD' && t2Str !== 'TBD' && t1Str !== 'null' && t2Str !== 'null' && t1Str === t2Str) return true;

        if (m.status === 'finished') {
            if ((m.type === 'regular' || m.type === 'super')) {
                if (!m.t1 || t1Str === 'TBD' || t1Str === 'null' || t1Str === 'undefined') return true;
                if (!m.t2 || t2Str === 'TBD' || t2Str === 'null' || t2Str === 'undefined') return true;
            }
            if (!m.result || !m.result.winner) return true;
            if (m.result.history && m.result.history.length > 0 && m.result.history[0]?.logs?.includes('데이터 오류')) return true;
        }
        return false;
    });

    const needsSync = targetLeague && (
        forceRegen ||
        activeMatches.length === 0 || 
        activeMatches.some(m => m.status === 'pending' && currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(m, currentPendingLCK) < 0) ||
        (currentPendingLCK.date === '99.99 (완료)' && activeMatches.some(m => m.status === 'pending')) ||
        // Generate playoff bracket when regular is done and no bracket exists yet
        (activeMatches.length > 0 &&
         activeMatches.filter(m => m.type === 'regular' || m.type === 'super').every(m => m.status === 'finished') &&
         activeMatches.filter(m => m.type === 'regular' || m.type === 'super').length > 0 &&
         !activeMatches.some(m => m.type === 'playoff' || m.type === 'playin') &&
         // LEC user's own league: Dashboard handles seed picking, don't auto-gen here
         !(isMyLeagueForeign && targetLeague === myLeague && myLeague === 'LEC') &&
         // For user's own league: only generate bracket if season is actually started (gate !== '0.01')
         // For other leagues: only when user is fully done (gate = 99.99)
         (targetLeague === myLeague
            ? currentPendingLCK.date !== '0.01'
            : currentPendingLCK.date === '99.99 (완료)')) ||
        // Always trigger sync if any playoff match is missing its advancing teams to ensure bracket flows forward
        activeMatches.some(m => (m.type === 'playoff' || m.type === 'playin') && (!m.t1 || !m.t2 || String(m.t1) === 'TBD' || String(m.t2) === 'TBD' || String(m.t1) === 'null' || String(m.t2) === 'null'))
    );

    const hasErrors = targetLeague ? checkBadData(activeMatches, targetLeague) : false;

    useEffect(() => {
        if (displayLeague === 'LCK' && league.matches) {
            const hasCorruptedFormat = league.matches.some(m =>
                m.type !== 'playoff' && (!m.format || m.format === 'BO1')
            );
            if (hasCorruptedFormat) {
                const healedMatches = league.matches.map(m => {
                    if (m.type === 'super')   return { ...m, format: 'BO3' }; // Fix 16.02 meta fallback
                    if (m.type === 'regular') return { ...m, format: 'BO3' };
                    if (m.type === 'playoff' && !m.format) return { ...m, format: 'BO5' };
                    return m;
                });
                const updatedLeague = { ...league, matches: healedMatches };
                updateLeague(league.id, updatedLeague);
                if (setLeague) setLeague(updatedLeague);
            }
        }
    }, [displayLeague, league, setLeague]);

    // ── LCK auto-sim for foreign players ────────────────────────────────────
    // Sims ALL pending LCK match types (regular, super, playin, playoff) date-by-date.
    useEffect(() => {
        if (!isMyLeagueForeign) return;
        if (displayLeague !== 'LCK') return;
        if (!league.matches || league.matches.length === 0) return;
        if (currentPendingLCK.date === '0.01') return;

        const simable = league.matches.filter(m =>
            m.status === 'pending' &&
            m.t1 && m.t2 &&
            String(m.t1) !== 'TBD' && String(m.t2) !== 'TBD' &&
            compareDatesObj(m, currentPendingLCK) < 0
        );
        if (simable.length === 0) return;

        let updated = false;
        const newMatches = league.matches.map(m => {
            if (m.status !== 'pending') return m;
            if (compareDatesObj(m, currentPendingLCK) >= 0) return m;
            if (!m.t1 || !m.t2 || String(m.t1) === 'TBD' || String(m.t2) === 'TBD') return m;

            const getId = v => typeof v === 'object' ? Number(v?.id) : Number(v);
            const t1Obj = teams.find(t => t.id === getId(m.t1));
            const t2Obj = teams.find(t => t.id === getId(m.t2));
            if (!t1Obj || !t2Obj) return m;

            const useMeta = (league.metaVersion === '16.02' || league.metaVersion === '16.03') 
                ? (league.currentChampionList || championList) 
                : championList;
            const fmt = m.format || (m.type === 'playoff' ? 'BO5' : 'BO3'); // Fix format fallback

            try {
                const t1 = { ...t1Obj, roster: getSafeRoster(t1Obj, playersLCK) };
                const t2 = { ...t2Obj, roster: getSafeRoster(t2Obj, playersLCK) };
                const sim = quickSimulateMatch(t1, t2, fmt, useMeta);
                let score = typeof sim.scoreString === 'string' ? sim.scoreString
                    : typeof sim.score === 'object'
                        ? `${Math.max(sim.score.A ?? 0, sim.score.B ?? 0)}-${Math.min(sim.score.A ?? 0, sim.score.B ?? 0)}`
                        : (fmt === 'BO5' ? '3-0' : fmt === 'BO1' ? '1-0' : '2-0');
                if (fmt === 'BO1') score = '1-0';
                updated = true;
                return {
                    ...m, status: 'finished',
                    result: { winner: sim.winner?.name || sim.winner, score, history: (sim.history || []).map(s => ({ ...s, logs: [] })) }
                };
            } catch (e) {
                const t1w = (t1Obj.power || 80) + (Math.random() * 10 - 5) >= (t2Obj.power || 80) + (Math.random() * 10 - 5);
                updated = true;
                return { ...m, status: 'finished', result: { winner: t1w ? t1Obj.name : t2Obj.name, score: fmt === 'BO5' ? '3-0' : '2-0', history: [] } };
            }
        });

        if (updated) {
            const updatedLeague = { ...league, matches: newMatches };
            updateLeague(league.id, updatedLeague);
            if (setLeague) setLeague(updatedLeague);
        }
    }, [isMyLeagueForeign, displayLeague, currentPendingLCK.date, league.matches?.length, league.metaVersion]);

    useEffect(() => {
        if (!needsSync || !targetLeague) { setSyncDone(true); return; }

        const lgTeams = FOREIGN_LEAGUES[targetLeague] || [];
        const lgPlayers = (FOREIGN_PLAYERS && FOREIGN_PLAYERS[targetLeague]) ? FOREIGN_PLAYERS[targetLeague] : [];
        let isUpdated = false;

        let schedule = activeMatches.filter(m => m.type === 'regular' || m.type === 'super');
        
        if (schedule.length === 0 || forceRegen) {
            if (targetLeague === 'LPL') schedule = generateLPLRegularSchedule(lgTeams);
            else if (targetLeague === 'LCP') schedule = generateLCPRegularSchedule(lgTeams);
            else if (targetLeague === 'CBLOL') schedule = generateCBLOLRegularSchedule(lgTeams); 
            else if (targetLeague === 'LCS') schedule = generateLCSRegularSchedule(lgTeams);
            else if (targetLeague === 'LEC') schedule = generateLECRegularSchedule(lgTeams);
            isUpdated = true;
        }

        if (targetLeague === 'LCS') {
            const getSwissStandings = (pastMatches) => {
                const st = {};
                lgTeams.forEach(t => st[t.name] = { w: 0, l: 0, played: [] });
                pastMatches.forEach(m => {
                    if (m.status === 'finished' && m.result && m.result.winner) {
                        const wName = findGlobalTeam(m.result.winner, lgTeams).name;
                        const t1Name = findGlobalTeam(m.t1, lgTeams).name;
                        const t2Name = findGlobalTeam(m.t2, lgTeams).name;
                        const lName = wName === t1Name ? t2Name : t1Name;
                        if(st[wName]) { st[wName].w++; st[wName].played.push(lName); }
                        if(st[lName]) { st[lName].l++; st[lName].played.push(wName); }
                    }
                });
                return st;
            };

            [2, 3].forEach(roundNum => {
                const roundMatches = schedule.filter(m => m.swissRound === roundNum);
                if (roundMatches.some(m => !m.t1 || !m.t2)) {
                    const prevRoundFinished = schedule.filter(m => m.swissRound === roundNum - 1).every(m => m.status === 'finished');
                    if (prevRoundFinished) {
                        const pastMatches = schedule.filter(m => m.swissRound < roundNum && m.status === 'finished');
                        const st = getSwissStandings(pastMatches);
                        const pools = {};
                        Object.entries(st).forEach(([tName, record]) => {
                            const bracketStr = `${record.w}-${record.l}`;
                            if (!pools[bracketStr]) pools[bracketStr] = [];
                            pools[bracketStr].push(tName);
                        });

                        roundMatches.forEach(m => {
                            if (!m.t1 || !m.t2) {
                                let pool = pools[m.bracket] || [];
                                pool = [...new Set(pool)]; 
                                if (pool.length >= 2) {
                                    pool = pool.sort(() => Math.random() - 0.5); 
                                    let t1 = pool[0];
                                    let t2Index = pool.findIndex((t, idx) => idx > 0 && !st[t1].played.includes(t));
                                    if (t2Index <= 0) t2Index = 1; 
                                    let t2 = pool[t2Index];
                                    if (t1 === t2) {
                                        const emergencyT2 = pool.find(t => t !== t1);
                                        if (emergencyT2) t2 = emergencyT2;
                                        else t2 = lgTeams.find(t => t.name !== t1).name; 
                                    }
                                    m.t1 = t1;
                                    m.t2 = t2;
                                    pools[m.bracket] = pool.filter(t => t !== t1 && t !== t2);
                                    isUpdated = true;
                                } else {
                                    const assigned = roundMatches.flatMap(rm => [rm.t1, rm.t2]).filter(Boolean);
                                    const remaining = lgTeams.map(t => t.name).filter(t => !assigned.includes(t));
                                    if (remaining.length >= 2) {
                                        m.t1 = remaining[0];
                                        m.t2 = remaining[1];
                                        isUpdated = true;
                                    }
                                }
                            }
                        });
                    }
                }
            });
        }

        const getMatchMeta = (matchObj) => {
            // Use same logic as LCK auto-simulation for consistency
            const useMeta = (league.metaVersion === '16.02' || league.metaVersion === '16.03') 
                ? (league.currentChampionList || championList) 
                : championList;
            return useMeta;
        };

        const simMatchIfPast = (matchObj) => {
            if (matchObj.status === 'finished') return matchObj; 

            // CRITICAL: never auto-sim any playoff/playin match in the user's own league.
            // Those must be driven by the dashboard (handleProceedNextMatch / handleStartMyMatch).
            // Also never auto-sim any match involving the user's own team.
            if (isMyLeagueForeign && targetLeague === myLeague) {
                if (matchObj.type === 'playoff' || matchObj.type === 'playin') return matchObj;
                const myName = myTeam?.name;
                const myId   = myTeam?.id;
                if (myName && (
                    matchObj.t1 === myName || matchObj.t2 === myName ||
                    matchObj.t1 === myId   || matchObj.t2 === myId
                )) return matchObj;
            }

            if (currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(matchObj, currentPendingLCK) >= 0) return matchObj;

            const t1Obj = findGlobalTeam(matchObj.t1, lgTeams);
            const t2Obj = findGlobalTeam(matchObj.t2, lgTeams);
            
            if (!t1Obj.name || !t2Obj.name || t1Obj.name === 'TBD' || t2Obj.name === 'TBD' || t1Obj.name === 'null' || t2Obj.name === 'null') return matchObj; 
            if (t1Obj.name === t2Obj.name) return matchObj; 

            const t1 = { ...t1Obj, roster: getSafeRoster(t1Obj, lgPlayers) };
            const t2 = { ...t2Obj, roster: getSafeRoster(t2Obj, lgPlayers) };
            const matchMetaList = getMatchMeta(matchObj);

            try {
                const simResult = quickSimulateMatch(t1, t2, matchObj.format, matchMetaList);
                
                let fScore = simResult.scoreString || simResult.score;
                let matchWinner = simResult.winner?.name || simResult.winner;
                let liteHistory = (simResult.history || []).map(set => ({ ...set, logs: [] }));

                if (matchObj.format === 'BO1') {
                    if (liteHistory.length > 0) { liteHistory = [liteHistory[0]]; matchWinner = liteHistory[0].winner; }
                    fScore = '1-0';
                } else {
                    if (typeof fScore === 'object') fScore = `${Math.max(fScore.A ?? 0, fScore.B ?? 0)}-${Math.min(fScore.A ?? 0, fScore.B ?? 0)}`;
                    if (!fScore) {
                        const isBO5 = matchObj.format === 'BO5' || matchObj.type === 'playoff';
                        fScore = `${isBO5 ? 3 : 2}-0`;
                    }
                }

                return {
                    ...matchObj,
                    t1: t1.id || t1.name, 
                    t2: t2.id || t2.name,
                    status: 'finished',
                    result: { winner: matchWinner, score: fScore, history: liteHistory }
                };
            } catch (e) {
                console.error("Engine Crash Blocked:", e);
                const isBO1 = matchObj.format === 'BO1';
                const isBO5 = matchObj.format === 'BO5' || matchObj.type === 'playoff';
                const reqWins = isBO5 ? 3 : (isBO1 ? 1 : 2);
                const t1Wins = Math.random() > 0.5;
                
                return {
                    ...matchObj,
                    t1: t1.id || t1.name, 
                    t2: t2.id || t2.name,
                    status: 'finished',
                    result: {
                        winner: t1Wins ? t1.name : t2.name,
                        score: t1Wins ? `${reqWins}-0` : `0-${reqWins}`,
                        history: [{ logs: [], winner: t1Wins ? t1.name : t2.name }] 
                    }
                };
            }
        };

        schedule = schedule.map((match) => {
            const simmed = simMatchIfPast(match);
            if (simmed.status === 'finished' && match.status !== 'finished') {
                isUpdated = true;
            }
            return simmed;
        });

        let playoffs = forceRegen ? [] : activeMatches.filter(m => m.type === 'playoff' || m.type === 'playin');
        let seeds = forceRegen ? [] : (league.foreignPlayoffSeeds?.[targetLeague] || []);
        
        if (schedule.every(m => m.status === 'finished')) {
            if (seeds.length === 0) {
                const standings = {};
                lgTeams.forEach(t => standings[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], id: t.id || t.name, name: t.name });
                
                schedule.forEach(m => {
                    if (m.status === 'finished' && m.result && m.result.winner && m.result.winner !== 'Unknown') {
                        const wName = findGlobalTeam(m.result.winner, lgTeams).name;
                        const t1Name = findGlobalTeam(m.t1, lgTeams).name;
                        const t2Name = findGlobalTeam(m.t2, lgTeams).name;
                        const loserName = wName === t1Name ? t2Name : t1Name;
                        
                        let diffValue = 0;
                        if (m.result.score) {
                            const parts = String(m.result.score).split(/[-:]/).map(Number);
                            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) diffValue = Math.abs(parts[0] - parts[1]);
                        }

                        if (standings[wName]) {
                            standings[wName].w += 1;
                            standings[wName].diff += diffValue;
                            standings[wName].defeatedOpponents.push(loserName);
                            if (!standings[wName].h2h[loserName]) standings[wName].h2h[loserName] = { w: 0, l: 0 };
                            standings[wName].h2h[loserName].w += 1;
                        }
                        if (standings[loserName]) {
                            standings[loserName].l += 1;
                            standings[loserName].diff -= diffValue;
                            if (!standings[loserName].h2h[wName]) standings[loserName].h2h[wName] = { w: 0, l: 0 };
                            standings[loserName].h2h[wName].l += 1;
                        }
                    }
                });

                const tiedGroups = {};
                Object.values(standings).forEach(rec => {
                    const key = `${rec.w}_${rec.diff}`;
                    if (!tiedGroups[key]) tiedGroups[key] = [];
                    tiedGroups[key].push(rec.name);
                });

                const sorted = Object.values(standings).sort((a,b) => {
                    if (b.w !== a.w) return b.w - a.w; 
                    if (b.diff !== a.diff) return b.diff - a.diff; 
                    const tieKey = `${a.w}_${a.diff}`;
                    const tiedCount = tiedGroups[tieKey]?.length || 0;
                    if (tiedCount === 2) {
                        const aWinsVsB = a.h2h[b.name]?.w || 0;
                        const bWinsVsA = b.h2h[a.name]?.w || 0;
                        if (aWinsVsB !== bWinsVsA) return bWinsVsA - aWinsVsB;
                    }
                    let sovWinsA = 0, sovDiffA = 0;
                    a.defeatedOpponents.forEach(opp => { sovWinsA += (standings[opp]?.w || 0); sovDiffA += (standings[opp]?.diff || 0); });
                    let sovWinsB = 0, sovDiffB = 0;
                    b.defeatedOpponents.forEach(opp => { sovWinsB += (standings[opp]?.w || 0); sovDiffB += (standings[opp]?.diff || 0); });
                    if (sovWinsB !== sovWinsA) return sovWinsB - sovWinsA;
                    if (sovDiffB !== sovDiffA) return sovDiffB - sovDiffA;
                    return 0;
                });

                if (targetLeague === 'LPL') {
                    const getGroupRankings = (groupNames) => {
                        return sorted.filter(t => groupNames.some(name => {
                            const upperTId = String(t.id).toUpperCase().trim();
                            const upperTName = String(t.name).toUpperCase().trim();
                            const upperName = String(name).toUpperCase().trim();
                            return upperTId === upperName || upperTName === upperName || upperTName.startsWith(upperName) || upperTName.includes(upperName + ' ');
                        }));
                    };

                    const topGroup = getGroupRankings(['AL', 'BLG', 'WBG', 'JDG', 'TES', 'IG']);
                    const midGroup = getGroupRankings(['NIP', 'WE', 'EDG', 'TT']);
                    const botGroup = getGroupRankings(['LNG', 'OMG', 'LGD', 'UP']);
                    
                    const extractedSeeds = [
                        ...topGroup.slice(0, 6).map((t, idx) => ({ ...t, seed: idx + 1 })),
                        ...midGroup.slice(0, 4).map((t, idx) => ({ ...t, seed: idx + 7 })),
                        ...botGroup.slice(0, 2).map((t, idx) => ({ ...t, seed: idx + 11 }))
                    ];

                    const placedIds = extractedSeeds.map(s => s.id);
                    const unplaced = sorted.filter(s => !placedIds.includes(s.id));
                    for (let i = 1; i <= 12; i++) {
                        if (!extractedSeeds.find(s => s.seed === i)) {
                            if (unplaced.length > 0) {
                                const backup = unplaced.shift();
                                extractedSeeds.push({ ...backup, seed: i });
                            }
                        }
                    }
                    seeds = extractedSeeds.sort((a, b) => a.seed - b.seed);
                }
                else if (targetLeague === 'LCP') seeds = sorted.slice(0, 6).map((t, idx) => ({ ...t, seed: idx + 1 }));
                else if (targetLeague === 'CBLOL' || targetLeague === 'LCS' || targetLeague === 'LEC') seeds = sorted.slice(0, 8).map((t, idx) => ({ ...t, seed: idx + 1 }));
                isUpdated = true;
            }

            if (playoffs.length === 0 || forceRegen) {
                if (targetLeague === 'LPL') playoffs = generateLPLPlayoffs(seeds);
                else if (targetLeague === 'LCP') playoffs = generateLCPPlayoffs(seeds);
                else if (targetLeague === 'CBLOL') playoffs = generateCBLOLPlayoffs(seeds);
                else if (targetLeague === 'LCS') playoffs = generateLCSPlayoffs(seeds);
                else if (targetLeague === 'LEC') playoffs = generateLECPlayoffs(seeds);
                isUpdated = true;
            }

        const simPlayoffMatch = (id) => {
                const matchObj = playoffs.find(m => m.id === id);
                if (!matchObj) return { winnerId: null, loserId: null };

                if (matchObj.status === 'finished') {
                    const wId = findGlobalTeam(matchObj.result.winner, teams).name;
                    // Always resolve BOTH winner and loser to names so downstream assignments
                    // are consistent regardless of whether raw ids or names are stored.
                    const t1Name = findGlobalTeam(matchObj.t1, teams).name;
                    const t2Name = findGlobalTeam(matchObj.t2, teams).name;
                    const lId = (wId && t1Name && wId === t1Name) ? t2Name : t1Name;
                    return { winnerId: wId, loserId: lId };
                }

                if (currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(matchObj, currentPendingLCK) >= 0) return { winnerId: null, loserId: null };

                if (!matchObj.t1 || !matchObj.t2 || matchObj.t1 === 'TBD' || matchObj.t2 === 'TBD' || matchObj.t1 === 'null' || matchObj.t2 === 'null' || matchObj.t1 === matchObj.t2) {
                    return { winnerId: null, loserId: null };
                }

                const simulatedMatch = simMatchIfPast(matchObj);
                
                if (simulatedMatch.status === 'finished') {
                    Object.assign(matchObj, simulatedMatch); 
                    isUpdated = true; 
                    const wId = findGlobalTeam(simulatedMatch.result.winner, teams).name;
                    // Resolve both to names — avoids raw-id vs resolved-name mismatch
                    const t1Name = findGlobalTeam(matchObj.t1, teams).name;
                    const t2Name = findGlobalTeam(matchObj.t2, teams).name;
                    const lId = (wId && t1Name && wId === t1Name) ? t2Name : t1Name;
                    return { winnerId: wId, loserId: lId };
                }

                return { winnerId: null, loserId: null };
            };

            const assignT1 = (match, t1) => { if (match && (!match.t1 || match.t1 === 'TBD' || match.t1 === 'null') && t1) { match.t1 = t1; isUpdated = true; } };
            const assignT2 = (match, t2) => { if (match && (!match.t2 || match.t2 === 'TBD' || match.t2 === 'null') && t2) { match.t2 = t2; isUpdated = true; } };
            const assignTeam = (match, t1, t2) => { assignT1(match, t1); assignT2(match, t2); };

            const getSeedId = (s) => seeds.find(x => x.seed === s)?.name || seeds.find(x => x.seed === s)?.id || null;

            if (targetLeague === 'LPL') {
                // --- PLAY-IN ---
                const pi1g1 = simPlayoffMatch('lpl_pi1');
                const pi1g2 = simPlayoffMatch('lpl_pi2');
                const pi2g1 = simPlayoffMatch('lpl_pi3');
                const pi2g2 = simPlayoffMatch('lpl_pi4');

                const pi3g1Match = playoffs.find(m => m.id === 'lpl_pi5');
                assignTeam(pi3g1Match, pi1g1.loserId, pi2g1.winnerId);
                const pi3g1 = simPlayoffMatch('lpl_pi5');

                const pi3g2Match = playoffs.find(m => m.id === 'lpl_pi6');
                assignTeam(pi3g2Match, pi1g2.loserId, pi2g2.winnerId);
                const pi3g2 = simPlayoffMatch('lpl_pi6');

                // --- UPPER BRACKET R1 ---
                const po1ub1Match = playoffs.find(m => m.id === 'lpl_po1');
                assignT1(po1ub1Match, getSeedId(1)); assignT2(po1ub1Match, pi3g2.winnerId);
                const po1ub1 = simPlayoffMatch('lpl_po1');

                const po1ub2Match = playoffs.find(m => m.id === 'lpl_po2');
                assignT1(po1ub2Match, getSeedId(4)); assignT2(po1ub2Match, pi1g1.winnerId);
                const po1ub2 = simPlayoffMatch('lpl_po2');

                const po1ub3Match = playoffs.find(m => m.id === 'lpl_po3');
                assignT1(po1ub3Match, getSeedId(2)); assignT2(po1ub3Match, pi3g1.winnerId);
                const po1ub3 = simPlayoffMatch('lpl_po3');

                const po1ub4Match = playoffs.find(m => m.id === 'lpl_po4');
                assignT1(po1ub4Match, getSeedId(3)); assignT2(po1ub4Match, pi1g2.winnerId);
                const po1ub4 = simPlayoffMatch('lpl_po4');

                // --- UPPER BRACKET R2 ---
                const po2ub1Match = playoffs.find(m => m.id === 'lpl_po5');
                assignTeam(po2ub1Match, po1ub1.winnerId, po1ub2.winnerId);
                const po2ub1 = simPlayoffMatch('lpl_po5');

                const po2ub2Match = playoffs.find(m => m.id === 'lpl_po6');
                assignTeam(po2ub2Match, po1ub3.winnerId, po1ub4.winnerId);
                const po2ub2 = simPlayoffMatch('lpl_po6');

                // --- LOWER BRACKET R1 ---
                const po1lb1Match = playoffs.find(m => m.id === 'lpl_po7');
                assignTeam(po1lb1Match, po1ub1.loserId, po1ub2.loserId);
                const po1lb1 = simPlayoffMatch('lpl_po7');

                const po1lb2Match = playoffs.find(m => m.id === 'lpl_po8');
                assignTeam(po1lb2Match, po1ub3.loserId, po1ub4.loserId);
                const po1lb2 = simPlayoffMatch('lpl_po8');

                // --- LOWER BRACKET R2 ---
                const po2lb1Match = playoffs.find(m => m.id === 'lpl_po9');
                assignTeam(po2lb1Match, po1lb1.winnerId, po2ub2.loserId);
                const po2lb1 = simPlayoffMatch('lpl_po9');

                const po2lb2Match = playoffs.find(m => m.id === 'lpl_po10');
                assignTeam(po2lb2Match, po1lb2.winnerId, po2ub1.loserId);
                const po2lb2 = simPlayoffMatch('lpl_po10');

                // --- ROUND 3 ---
                const po3ubMatch = playoffs.find(m => m.id === 'lpl_po11');
                assignTeam(po3ubMatch, po2ub1.winnerId, po2ub2.winnerId);
                const po3ub = simPlayoffMatch('lpl_po11');

                const po3lbMatch = playoffs.find(m => m.id === 'lpl_po12');
                assignTeam(po3lbMatch, po2lb1.winnerId, po2lb2.winnerId);
                const po3lb = simPlayoffMatch('lpl_po12');

                // --- ROUND 4 ---
                const po4lbMatch = playoffs.find(m => m.id === 'lpl_po13');
                assignTeam(po4lbMatch, po3ub.loserId, po3lb.winnerId);
                const po4lb = simPlayoffMatch('lpl_po13');

                // --- FINAL ---
                const finalMatch = playoffs.find(m => m.id === 'lpl_po14');
                assignTeam(finalMatch, po3ub.winnerId, po4lb.winnerId);
                simPlayoffMatch('lpl_po14');
            

            } else if (targetLeague === 'LCP') {
                const r1m1Match = playoffs.find(m => m.id === 'lcp_po1');
                assignTeam(r1m1Match, getSeedId(3), getSeedId(r1m1Match?.t2 === getSeedId(6) ? 6 : 5));
                const r1m1 = simPlayoffMatch('lcp_po1');

                const r1m2Match = playoffs.find(m => m.id === 'lcp_po2');
                assignTeam(r1m2Match, getSeedId(4), getSeedId(r1m2Match?.t2 === getSeedId(5) ? 5 : 6));
                const r1m2 = simPlayoffMatch('lcp_po2');

                const po3 = playoffs.find(m => m.id === 'lcp_po3');
                assignT1(po3, getSeedId(1)); assignT2(po3, r1m1.winnerId);
                const r2m1 = simPlayoffMatch('lcp_po3');

                const po4 = playoffs.find(m => m.id === 'lcp_po4');
                assignT1(po4, getSeedId(2)); assignT2(po4, r1m2.winnerId);
                const r2m2 = simPlayoffMatch('lcp_po4');

                const po5 = playoffs.find(m => m.id === 'lcp_po5');
                assignTeam(po5, r2m1.winnerId, r2m2.winnerId);
                const r3m1 = simPlayoffMatch('lcp_po5');

                const po6 = playoffs.find(m => m.id === 'lcp_po6');
                assignTeam(po6, r2m1.loserId, r2m2.loserId);
                const r2lm1 = simPlayoffMatch('lcp_po6');

                const po7 = playoffs.find(m => m.id === 'lcp_po7');
                assignTeam(po7, r2lm1.winnerId, r3m1.loserId);
                const r3lm1 = simPlayoffMatch('lcp_po7');

                const po8 = playoffs.find(m => m.id === 'lcp_po8');
                assignTeam(po8, r3m1.winnerId, r3lm1.winnerId);
                simPlayoffMatch('lcp_po8');

            } else if (targetLeague === 'CBLOL') {
                const pi1Match = playoffs.find(m => m.id === 'cblol_pi1');
                assignTeam(pi1Match, getSeedId(7), getSeedId(8));
                const pi1 = simPlayoffMatch('cblol_pi1');

                const pi2Match = playoffs.find(m => m.id === 'cblol_pi2');
                assignTeam(pi2Match, getSeedId(5), getSeedId(6));
                const pi2 = simPlayoffMatch('cblol_pi2');

                const pi3Match = playoffs.find(m => m.id === 'cblol_pi3');
                assignTeam(pi3Match, pi1.winnerId, pi2.loserId);
                const pi3 = simPlayoffMatch('cblol_pi3');

                const po1Match = playoffs.find(m => m.id === 'cblol_po1');
                assignT1(po1Match, getSeedId(3));
                if (pi2.winnerId && pi3.winnerId && !po1Match.t2) {
                    // Guard: if pi2.winner === pi3.winner (data corruption), prefer pi3.winner for po1
                    // and leave po2 empty rather than put the same team in both slots.
                    const qual1 = pi3.winnerId;
                    const qual2 = (pi2.winnerId !== pi3.winnerId) ? pi2.winnerId : null;
                    po1Match.t2 = qual1;
                    isUpdated = true;
                    const po2Match2 = playoffs.find(m => m.id === 'cblol_po2');
                    if (qual2 && po2Match2 && !po2Match2.t2) { po2Match2.t2 = qual2; isUpdated = true; }
                }
                const po1 = simPlayoffMatch('cblol_po1');

                const po2Match = playoffs.find(m => m.id === 'cblol_po2');
                assignT1(po2Match, getSeedId(4));
                if (pi2.winnerId && pi3.winnerId && !po2Match.t2) {
                    // Fallback: if po2.t2 still not set (only 1 qualifier resolved), use pi2.winner
                    po2Match.t2 = (pi2.winnerId !== pi3.winnerId) ? pi2.winnerId : pi3.winnerId;
                    isUpdated = true;
                }
                const po2 = simPlayoffMatch('cblol_po2');

                const po3Match = playoffs.find(m => m.id === 'cblol_po3');
                assignT1(po3Match, getSeedId(1));
                const po4Match = playoffs.find(m => m.id === 'cblol_po4');
                assignT1(po4Match, getSeedId(2));
                if (po1.winnerId && po2.winnerId && !po3Match.t2) {
                    const pickLower = Math.random() < 0.90;
                    po3Match.t2 = pickLower ? po2.winnerId : po1.winnerId; 
                    po4Match.t2 = pickLower ? po1.winnerId : po2.winnerId; 
                    isUpdated = true;
                }
                const po3 = simPlayoffMatch('cblol_po3');
                const po4 = simPlayoffMatch('cblol_po4');

                const po5Match = playoffs.find(m => m.id === 'cblol_po5');
                assignTeam(po5Match, po3.winnerId, po4.winnerId);
                const po5 = simPlayoffMatch('cblol_po5'); 

                const po6Match = playoffs.find(m => m.id === 'cblol_po6');
                assignTeam(po6Match, po1.loserId, po2.loserId);
                const po6 = simPlayoffMatch('cblol_po6');

                const po7Match = playoffs.find(m => m.id === 'cblol_po7');
                if (po7Match && po6.winnerId && po3.loserId && po4.loserId && !po7Match.t2) {
                    po7Match.t1 = po6.winnerId; po7Match.t2 = po4.loserId; isUpdated = true;
                }
                const po7 = simPlayoffMatch('cblol_po7');

                const po8Match = playoffs.find(m => m.id === 'cblol_po8');
                if (po8Match && po7.winnerId && po3.loserId && po4.loserId && !po8Match.t2) {
                    po8Match.t1 = po7.winnerId; po8Match.t2 = po3.loserId; isUpdated = true;
                }
                const po8 = simPlayoffMatch('cblol_po8');

                const po9Match = playoffs.find(m => m.id === 'cblol_po9');
                assignTeam(po9Match, po8.winnerId, po5.loserId);
                const po9 = simPlayoffMatch('cblol_po9');

                const po10Match = playoffs.find(m => m.id === 'cblol_po10');
                assignTeam(po10Match, po5.winnerId, po9.winnerId);
                simPlayoffMatch('cblol_po10');
            
            } else if (targetLeague === 'LCS') {
                const pi1Match = playoffs.find(m => m.id === 'lcs_pi1');
                assignTeam(pi1Match, getSeedId(6), getSeedId(7));
                const pi1 = simPlayoffMatch('lcs_pi1');

                const po1Match = playoffs.find(m => m.id === 'lcs_po1');
                assignT1(po1Match, getSeedId(1));
                const po2Match = playoffs.find(m => m.id === 'lcs_po2');
                assignT1(po2Match, getSeedId(2));
                if (po1Match && !po1Match.t2 && getSeedId(3) && getSeedId(4)) {
                    po1Match.t2 = Math.random() < 0.90 ? getSeedId(4) : getSeedId(3);
                    po2Match.t2 = po1Match.t2 === getSeedId(4) ? getSeedId(3) : getSeedId(4);
                    isUpdated = true;
                }
                const po1 = simPlayoffMatch('lcs_po1');
                const po2 = simPlayoffMatch('lcs_po2');

                const po3Match = playoffs.find(m => m.id === 'lcs_po3');
                assignTeam(po3Match, po1.winnerId, po2.winnerId);
                const po3 = simPlayoffMatch('lcs_po3'); 

                const po4Match = playoffs.find(m => m.id === 'lcs_po4');
                assignT1(po4Match, getSeedId(5)); assignT2(po4Match, po1.loserId);
                const po4 = simPlayoffMatch('lcs_po4');

                const po5Match = playoffs.find(m => m.id === 'lcs_po5');
                assignTeam(po5Match, pi1.winnerId, po2.loserId);
                const po5 = simPlayoffMatch('lcs_po5');

                const po6Match = playoffs.find(m => m.id === 'lcs_po6');
                assignTeam(po6Match, po4.winnerId, po5.winnerId);
                const po6 = simPlayoffMatch('lcs_po6');

                const po7Match = playoffs.find(m => m.id === 'lcs_po7');
                assignTeam(po7Match, po3.loserId, po6.winnerId);
                const po7 = simPlayoffMatch('lcs_po7');

                const po8Match = playoffs.find(m => m.id === 'lcs_po8');
                assignTeam(po8Match, po3.winnerId, po7.winnerId);
                simPlayoffMatch('lcs_po8');

            } else if (targetLeague === 'LEC') {
                const ub1g1Match = playoffs.find(m => m.id === 'lec_po_ub1g1');
                assignT1(ub1g1Match, getSeedId(1)); assignT2(ub1g1Match, ub1g1Match?.t2 || getSeedId(8));
                const ub1g1 = simPlayoffMatch('lec_po_ub1g1');
                
                const ub1g2Match = playoffs.find(m => m.id === 'lec_po_ub1g2');
                assignT1(ub1g2Match, getSeedId(2)); assignT2(ub1g2Match, ub1g2Match?.t2 || getSeedId(7));
                const ub1g2 = simPlayoffMatch('lec_po_ub1g2');
                
                const ub1g3Match = playoffs.find(m => m.id === 'lec_po_ub1g3');
                assignT1(ub1g3Match, getSeedId(3)); assignT2(ub1g3Match, ub1g3Match?.t2 || getSeedId(6));
                const ub1g3 = simPlayoffMatch('lec_po_ub1g3');

                const ub1g4Match = playoffs.find(m => m.id === 'lec_po_ub1g4');
                assignT1(ub1g4Match, getSeedId(4)); assignT2(ub1g4Match, ub1g4Match?.t2 || getSeedId(5));
                const ub1g4 = simPlayoffMatch('lec_po_ub1g4');

                const ub2g1Match = playoffs.find(m => m.id === 'lec_po_ub2g1');
                assignTeam(ub2g1Match, ub1g1.winnerId, ub1g4.winnerId);
                const ub2g1 = simPlayoffMatch('lec_po_ub2g1');

                const ub2g2Match = playoffs.find(m => m.id === 'lec_po_ub2g2');
                assignTeam(ub2g2Match, ub1g2.winnerId, ub1g3.winnerId);
                const ub2g2 = simPlayoffMatch('lec_po_ub2g2');

                const lb1g1Match = playoffs.find(m => m.id === 'lec_po_lb1g1');
                assignTeam(lb1g1Match, ub1g1.loserId, ub1g4.loserId);
                const lb1g1 = simPlayoffMatch('lec_po_lb1g1');

                const lb1g2Match = playoffs.find(m => m.id === 'lec_po_lb1g2');
                assignTeam(lb1g2Match, ub1g2.loserId, ub1g3.loserId);
                const lb1g2 = simPlayoffMatch('lec_po_lb1g2');

                const lb2g1Match = playoffs.find(m => m.id === 'lec_po_lb2g1');
                assignTeam(lb2g1Match, lb1g1.winnerId, ub2g2.loserId);
                const lb2g1 = simPlayoffMatch('lec_po_lb2g1');

                const lb2g2Match = playoffs.find(m => m.id === 'lec_po_lb2g2');
                assignTeam(lb2g2Match, lb1g2.winnerId, ub2g1.loserId);
                const lb2g2 = simPlayoffMatch('lec_po_lb2g2');

                const ubfMatch = playoffs.find(m => m.id === 'lec_po_ubf');
                assignTeam(ubfMatch, ub2g1.winnerId, ub2g2.winnerId);
                const ubf = simPlayoffMatch('lec_po_ubf');

                const lbsfMatch = playoffs.find(m => m.id === 'lec_po_lbsf');
                assignTeam(lbsfMatch, lb2g1.winnerId, lb2g2.winnerId);
                const lbsf = simPlayoffMatch('lec_po_lbsf');

                const r4Match = playoffs.find(m => m.id === 'lec_po_r4');
                assignTeam(r4Match, lbsf.winnerId, ubf.loserId);
                const r4 = simPlayoffMatch('lec_po_r4');

                const finalMatch = playoffs.find(m => m.id === 'lec_po_final');
                assignTeam(finalMatch, r4.winnerId, ubf.winnerId);
                simPlayoffMatch('lec_po_final');
            }
        }

        if (isUpdated) {
            const fullSchedule = [...schedule, ...playoffs];
            const updatedLeague = { ...league };
            if (!updatedLeague.foreignMatches) updatedLeague.foreignMatches = { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] };
            
            updatedLeague.foreignMatches[targetLeague] = fullSchedule;
            updatedLeague.foreignPlayoffSeeds = updatedLeague.foreignPlayoffSeeds || {};
            updatedLeague.foreignPlayoffSeeds[targetLeague] = seeds;

            updateLeague(league.id, updatedLeague);
            if (setLeague) setLeague(updatedLeague);
            
            if (forceRegen) setForceRegen(false);
        }
        // Mark sync as complete regardless — avoids infinite loading when
        // some playoff matches are still TBD and can't be simulated yet.
        setSyncDone(true);
    }, [needsSync, currentPendingLCK, targetLeague, activeMatches, league, setLeague, teams, forceRegen, setSyncDone]);

    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 lg:p-8 min-h-[300px] lg:min-h-[600px] flex flex-col h-full lg:h-auto overflow-y-auto relative">
            
            {needsSync && !syncDone && (
                <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="text-4xl animate-spin mb-4">⏳</div>
                    <div className="text-lg font-black text-blue-600 animate-pulse">{targetLeague} 데이터를 동기화 중입니다...</div>
                </div>
            )}

            {activeTab === 'schedule' && (
                <>
                <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-40 rounded-lg mb-2 sm:mb-3">
                    {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL', ...(hasFST ? ['FST'] : [])].map(lg => (
                        <button
                            key={lg}
                            onClick={() => setCurrentLeague(lg)}
                            className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                                currentLeague === lg
                                    ? lg === 'FST'
                                        ? 'bg-gradient-to-r from-blue-700 to-purple-700 text-white ring-2 ring-blue-300 transform scale-105'
                                        : 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105'
                                    : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                            }`}
                        >
                            {lg === 'FST' ? '🌍 FST' : lg}
                        </button>
                    ))}
                </div>
                {/* ── Team filter row ── */}
                {(() => {
                    let leagueTeamNames = [];
                    if (currentLeague === 'LCK') {
                        // Use the teams prop (full roster) so playoff-only slots aren't missed.
                        // Store raw ID as key so filter works directly against m.t1/m.t2.
                        const teamPool = (teams || []).length > 0 ? teams : [];
                        if (teamPool.length > 0) {
                            leagueTeamNames = teamPool.map(t => ({
                                id: String(t.id),
                                label: formatTeamName ? formatTeamName(t.id, 'regular') : (t.name || t.id)
                            })).filter(t => t.label);
                        } else {
                            const rawIds = [...new Set((league.matches || []).flatMap(m => [m.t1, m.t2]).filter(t => t && t !== 'TBD' && t !== 'null' && t !== 'undefined'))];
                            leagueTeamNames = rawIds.map(id => ({
                                id: String(id),
                                label: formatTeamName ? formatTeamName(id, 'regular') : id
                            })).filter(t => t.label);
                        }
                    } else if (currentLeague === 'FST') {
                        leagueTeamNames = fstTeams.map(t => ({ id: t.name, label: t.name })).filter(t => t.label);
                    } else {
                        leagueTeamNames = (FOREIGN_LEAGUES[currentLeague] || []).map(t => ({ id: t.name || t.id, label: t.name || t.id })).filter(t => t.label);
                    }
                    if (leagueTeamNames.length === 0) return null;
                    return (
                        <div className="flex gap-1.5 px-1 pb-2 overflow-x-auto shrink-0 mb-3 sm:mb-4 scrollbar-hide">
                            <button
                                onClick={() => setSelectedTeam(null)}
                                className={`px-3 py-1 rounded-full font-bold text-[10px] lg:text-xs transition-all whitespace-nowrap border active:scale-95 ${
                                    selectedTeam === null
                                        ? 'bg-gray-800 text-white border-gray-800'
                                        : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                                }`}
                            >
                                전체
                            </button>
                            {leagueTeamNames.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setSelectedTeam(prev => prev === t.id ? null : t.id)}
                                    className={`px-3 py-1 rounded-full font-bold text-[10px] lg:text-xs transition-all whitespace-nowrap border active:scale-95 ${
                                        selectedTeam === t.id
                                            ? 'bg-blue-600 text-white border-blue-600 ring-1 ring-blue-400'
                                            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    );
                })()}
                </>
            )}

            <div className="flex items-center justify-between mb-4 lg:mb-6 shrink-0">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg lg:text-2xl font-black text-gray-900 flex items-center gap-2">
                        📅 {activeTab === 'team_schedule'
                            ? `${myTeam.name} 경기 일정`
                            : displayLeague === 'FST'
                                ? '🌍 FST 월드 토너먼트 일정'
                                : displayLeague === 'LCK'
                                    ? (lckView === 'split1' ? 'LCK 정규 일정' : 'LCK 컵 전체 일정')
                                    : `2026 ${displayLeague} 전체 일정`}
                    </h2>
                    {/* < > toggle: only shown when both Cup and Split 1 exist */}
                    {displayLeague === 'LCK' && hasLCKCupMatches && hasLCKSplit1Matches && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setLckView(v => v === 'cup' ? 'split1' : 'cup')}
                                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition"
                                title="이전"
                            >
                                ‹
                            </button>
                            <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                                {lckView === 'cup' ? '1 / 2' : '2 / 2'}
                            </span>
                            <button
                                onClick={() => setLckView(v => v === 'cup' ? 'split1' : 'cup')}
                                className="p-1 rounded hover:bg-gray-100 text-gray-500 transition"
                                title="다음"
                            >
                                ›
                            </button>
                        </div>
                    )}
                </div>
                {targetLeague && hasErrors && (
                    <button 
                        onClick={() => setForceRegen(true)}
                        className="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded-md font-bold shadow-sm transition-all animate-pulse"
                    >
                        ⚠️ 데이터 오류 수정 (재생성)
                    </button>
                )}
            </div>

            {/* ── FST Schedule View ── */}
            {displayLeague === 'FST' ? (
                fstMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pb-4">
                        {[...fstMatches].filter(m => {
                            if (!selectedTeam) return true;
                            const t1Fst = fstTeams.find(t => t.fstId === m.t1 || t.name === m.t1);
                            const t2Fst = fstTeams.find(t => t.fstId === m.t2 || t.name === m.t2);
                            return t1Fst?.name === selectedTeam || t2Fst?.name === selectedTeam;
                        }).sort(compareDatesObj).map((m, i) => {
                            const t1Fst = fstTeams.find(t => t.fstId === m.t1 || t.name === m.t1);
                            const t2Fst = fstTeams.find(t => t.fstId === m.t2 || t.name === m.t2);
                            const t1Name = t1Fst?.name || 'TBD';
                            const t2Name = t2Fst?.name || 'TBD';
                            const isFinished = m.status === 'finished';
                            const isPending = !isFinished && m.t1 && m.t2;

                            let badgeText = m.fstRound?.startsWith('GG') ? `🏟️ 그룹 ${m.group || ''}` : '🏆 플레이오프';
                            if (m.fstRound === 'Finals') badgeText = '🥇 결승';
                            else if (m.fstRound === 'PG1' || m.fstRound === 'PG2') badgeText = '🏆 플레이오프';

                            return (
                                <div key={i} className={`p-3 lg:p-4 rounded-lg border flex flex-col gap-1 lg:gap-2 ${
                                    m.fstRound === 'Finals' ? 'bg-yellow-50 border-yellow-400 ring-1 ring-yellow-300' :
                                    isPending ? 'bg-gray-900/5 border-gray-300' : 'bg-white border-gray-200'
                                }`}>
                                    <div className="flex justify-between text-[10px] lg:text-xs font-bold text-gray-500">
                                        <span>{m.date} {m.time}</span>
                                        <span className="font-bold text-blue-600">{badgeText}</span>
                                    </div>
                                    <div className="flex justify-between items-center mt-1 lg:mt-2">
                                        <div className="flex flex-col items-center w-1/3">
                                            <span className="font-bold text-xs lg:text-base text-center break-keep leading-tight text-gray-800">
                                                {t1Name === 'TBD' ? 'TBD' : t1Name}
                                            </span>
                                            {isFinished && m.result?.winner === t1Name && <span className="text-[10px] text-blue-500 font-bold mt-1">WIN</span>}
                                        </div>
                                        <div className="text-center font-bold flex flex-col items-center shrink-0 w-1/4">
                                            {isFinished ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-lg lg:text-xl text-gray-800">{m.result?.score || '3-0'}</span>
                                                    <button
                                                        onClick={() => onMatchClick && onMatchClick(recalcPogForMatch(m))}
                                                        className="mt-1 text-[9px] lg:text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 px-1.5 lg:px-2 py-0.5 rounded transition flex items-center gap-1 whitespace-nowrap"
                                                    >
                                                        <span>📊</span> <span className="hidden sm:inline">상세보기</span><span className="sm:hidden">기록</span>
                                                    </button>
                                                </div>
                                            ) : isPending ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="text-gray-400 text-sm">VS</span>
                                                    {onFSTSimulate && (
                                                        <button
                                                            onClick={() => onFSTSimulate(m)}
                                                            className="text-[9px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded font-bold transition"
                                                        >
                                                            ⚡시뮬
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs">대기 중</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center w-1/3">
                                            <span className="font-bold text-xs lg:text-base text-center break-keep leading-tight text-gray-800">
                                                {t2Name === 'TBD' ? 'TBD' : t2Name}
                                            </span>
                                            {isFinished && m.result?.winner === t2Name && <span className="text-[10px] text-blue-500 font-bold mt-1">WIN</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                        <div className="text-4xl mb-4">🌍</div>
                        <div className="text-xl font-bold">FST 일정이 없습니다.</div>
                        <p className="mt-2 text-sm text-gray-500">FST 토너먼트가 개막되면 일정이 표시됩니다.</p>
                    </div>
                )
            ) : ['LCK', 'LPL', 'LCP', 'CBLOL', 'LCS', 'LEC'].includes(displayLeague) ? (
                <>
                {/* ── Team Schedule: append FST matches if user is in FST ── */}
                {showFSTInTeamSchedule && fstMatches.length > 0 && (
                    <div className="mb-6">
                        <div className="text-xs font-black uppercase tracking-widest text-blue-600 mb-3 flex items-center gap-2">
                            <span>🌍</span> FST 월드 토너먼트
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {[...fstMatches]
                                .filter(m => m.t1 === myFSTTeam?.fstId || m.t2 === myFSTTeam?.fstId)
                                .sort(compareDatesObj)
                                .map((m, i) => {
                                    const t1Fst = fstTeams.find(t => t.fstId === m.t1);
                                    const t2Fst = fstTeams.find(t => t.fstId === m.t2);
                                    const t1Name = t1Fst?.name || 'TBD';
                                    const t2Name = t2Fst?.name || 'TBD';
                                    const isFinished = m.status === 'finished';
                                    const isMyFSTMatch = m.t1 === myFSTTeam?.fstId || m.t2 === myFSTTeam?.fstId;
                                    return (
                                        <div key={i} className={`p-3 rounded-lg border flex flex-col gap-1 ${isMyFSTMatch ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                                            <div className="flex justify-between text-[10px] font-bold text-gray-500">
                                                <span>{m.date} {m.time}</span>
                                                <span className="text-blue-600 font-bold">🌍 FST</span>
                                            </div>
                                            <div className="flex justify-between items-center mt-1">
                                                <span className={`font-bold text-xs text-center w-1/3 break-keep ${m.t1 === myFSTTeam?.fstId ? 'text-blue-600' : 'text-gray-800'}`}>{t1Name}</span>
                                                <div className="text-center w-1/4">
                                                    {isFinished ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-base text-gray-800">{m.result?.score || '3-0'}</span>
                                                            <button
                                                                onClick={() => onMatchClick && onMatchClick(recalcPogForMatch(m))}
                                                                className="mt-1 text-[9px] lg:text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 px-1.5 lg:px-2 py-0.5 rounded transition flex items-center gap-1 whitespace-nowrap"
                                                            >
                                                                <span>📊</span> <span className="hidden sm:inline">상세보기</span><span className="sm:hidden">기록</span>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">VS</span>
                                                    )}
                                                </div>
                                                <span className={`font-bold text-xs text-center w-1/3 break-keep ${m.t2 === myFSTTeam?.fstId ? 'text-blue-600' : 'text-gray-800'}`}>{t2Name}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
                {showFSTInTeamSchedule && fstMatches.length > 0 && (
                    <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3 flex items-center gap-2">
                        <span>🏆</span> LCK 리그
                    </div>
                )}
                {activeMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pb-4">
                        {activeMatches
                            .filter(m => {
                                if (activeTab === 'schedule') return true;
                                // team_schedule: only show user's matches
                                if (isMyLeagueForeign) {
                                    return m.t1 === myTeam.name || m.t2 === myTeam.name ||
                                           m.t1 === myTeam.id   || m.t2 === myTeam.id;
                                }
                                return m.t1 === myTeam.id || m.t2 === myTeam.id;
                            })
                            .filter(m => {
                                if (!selectedTeam) return true;
                                if (displayLeague === 'LCK') {
                                    // selectedTeam is a raw team ID for LCK
                                    return String(m.t1) === selectedTeam || String(m.t2) === selectedTeam;
                                }
                                // For foreign leagues / FST, selectedTeam is a name
                                const t1 = findGlobalTeam(m.t1, teams);
                                const t2 = findGlobalTeam(m.t2, teams);
                                return t1.name === selectedTeam || t2.name === selectedTeam || m.t1 === selectedTeam || m.t2 === selectedTeam;
                            })
                            .sort(compareDatesObj) 
                            .map((m, i) => {
                                const t1 = findGlobalTeam(m.t1, teams);
                                const t2 = findGlobalTeam(m.t2, teams);
                                const isMyMatch = isMyLeagueForeign
                                    ? (m.t1 === myTeam.name || m.t2 === myTeam.name || m.t1 === myTeam.id || m.t2 === myTeam.id)
                                    : (myTeam.id === m.t1 || myTeam.id === m.t2);
                                const isFinished = m.status === 'finished';
                                
                                const t1Name = (displayLeague === 'LCK' && formatTeamName) ? formatTeamName(m.t1, m.type) : t1.name;
                                const t2Name = (displayLeague === 'LCK' && formatTeamName) ? formatTeamName(m.t2, m.type) : t2.name;

                                let badgeColor = 'text-gray-500';
                                let badgeText = '정규시즌';
                                if (m.type === 'lck_split1_regular') { badgeColor = 'text-gray-500'; badgeText = '정규시즌'; }
                                else if (m.type === 'super') { badgeColor = 'text-purple-600'; badgeText = '🔥 슈퍼위크'; }
                                else if (m.type === 'playin') { badgeColor = 'text-indigo-600'; badgeText = m.label || '플레이-인'; }
                                else if (m.type === 'playoff') { badgeColor = 'text-yellow-600'; badgeText = m.label || '플레이오프'; }

                                const expectedFallbackScore = m.format === 'BO1' ? '1-0' : (m.format === 'BO5' ? '3-0' : '2-0');

                                return (
                                    <div key={i} className={`p-3 lg:p-4 rounded-lg border flex flex-col gap-1 lg:gap-2 ${isMyMatch ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex justify-between text-[10px] lg:text-xs font-bold text-gray-500">
                                            <span>{m.date} {m.time}</span>
                                            <span className={`font-bold ${badgeColor}`}>{badgeText}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-1 lg:mt-2">
                                            <div className="flex flex-col items-center w-1/3">
                                                <span className={`font-bold text-xs lg:text-base text-center break-keep leading-tight ${isMyMatch && (m.t1 === myTeam.id || m.t1 === myTeam.name) ? 'text-blue-600' : 'text-gray-800'}`}>{t1Name === 'TBD' ? 'TBD' : t1Name}</span>
                                                {isFinished && m.result?.winner === t1.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                            </div>
                                            <div className="text-center font-bold flex flex-col items-center shrink-0 w-1/4">
                                            {isFinished ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-lg lg:text-xl text-gray-800">
                                                        {m.result?.score || expectedFallbackScore}
                                                    </span>
                                                    <button 
                                                        onClick={() => onMatchClick && onMatchClick(recalcPogForMatch(m))}
                                                        className="mt-1 text-[9px] lg:text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 px-1.5 lg:px-2 py-0.5 rounded transition flex items-center gap-1 whitespace-nowrap"
                                                    >
                                                        <span>📊</span> <span className="hidden sm:inline">상세보기</span><span className="sm:hidden">기록</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm lg:text-base">VS</span>
                                            )}
                                            </div>
                                            <div className="flex flex-col items-center w-1/3">
                                                <span className={`font-bold text-xs lg:text-base text-center break-keep leading-tight ${isMyMatch && (m.t2 === myTeam.id || m.t2 === myTeam.name) ? 'text-blue-600' : 'text-gray-800'}`}>{t2Name === 'TBD' ? 'TBD' : t2Name}</span>
                                                {isFinished && m.result?.winner === t2.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                        <div className="text-2xl lg:text-4xl mb-2 lg:mb-4">⏳</div>
                        <div className="text-lg lg:text-xl font-bold">{displayLeague} 일정이 없습니다.</div>
                        <p className="mt-2 text-sm text-gray-500">
                            {displayLeague === 'LCK' ? 'LCK 리그가 시작되면 일정이 자동으로 생성됩니다.' : `${displayLeague} 탭을 클릭하면 일정이 자동으로 생성됩니다.`}
                        </p>
                    </div>
                )}
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-4xl lg:text-6xl mb-3 lg:mb-4 animate-bounce">🌍</div>
                    <div className="text-xl lg:text-2xl font-black text-gray-600">{currentLeague} 일정 준비 중</div>
                </div>
            )}
        </div>
    );
};

export default ScheduleTab;