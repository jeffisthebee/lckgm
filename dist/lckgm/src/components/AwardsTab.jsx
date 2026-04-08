// src/components/AwardsTab.jsx
import React, { useState, useMemo } from 'react';
import { computeAwards, computePlayoffAwards } from '../engine/statsManager';

// Import Global Leagues AND Global Players!
import { FOREIGN_LEAGUES, FOREIGN_PLAYERS } from '../data/foreignLeagues';
import { TEAM_COLORS } from '../data/constants'; 

const globalPlayerList = Object.values(FOREIGN_PLAYERS || {}).flat().filter(Boolean);

// --- HELPER: Calculate POS (Player of the Series) ---
const calculatePOS = (history, winningTeamName) => {
    if (!history || !Array.isArray(history) || history.length === 0) return null;
    const playerScores = {};
    history.forEach(game => {
        const picksA = game.picks?.A || [];
        const picksB = game.picks?.B || [];
        const winName = winningTeamName?.trim().toLowerCase();

        // Robustly identify which side belongs to the series winner (case-insensitive + partial match)
        const teamAName = picksA[0]?.playerData?.팀?.trim().toLowerCase();
        const teamBName = picksB[0]?.playerData?.팀?.trim().toLowerCase();
        const aMatchesWinner = teamAName && winName && (
            teamAName === winName || teamAName.includes(winName) || winName.includes(teamAName)
        );
        const bMatchesWinner = teamBName && winName && (
            teamBName === winName || teamBName.includes(winName) || winName.includes(teamBName)
        );

        let targetPicks = null;
        if (aMatchesWinner && !bMatchesWinner) targetPicks = picksA;
        else if (bMatchesWinner && !aMatchesWinner) targetPicks = picksB;
        else if (aMatchesWinner && bMatchesWinner) targetPicks = picksA; // tie-break
        else return; // can't identify winner's side — skip to avoid awarding MVP to wrong team

        (targetPicks || []).forEach(p => {
            if (!p) return;
            if (!playerScores[p.playerName]) playerScores[p.playerName] = { ...p, totalScore: 0, games: 0, playerData: p.playerData };
            const stats = p.stats || { kills: p.k || 0, deaths: p.d || 0, assists: p.a || 0 };
            const k = stats.kills ?? p.k ?? 0;
            const d = (stats.deaths ?? p.d) || 0;
            const a = stats.assists ?? p.a ?? 0;
            const gold = p.currentGold || 0;

            // POS Formula — kills weighted 3x, assists 0.25x, deaths floored at 1.5
            const kda = (k * 3 + a * 0.25) / Math.max(d, 1.5);
            let score = 65 + kda + (gold / 1500);

            // Additive role boosts — deaths reduce boost so feeders don't get free points
            const role = p.playerData?.포지션 || p.role || 'MID';
            if (['SUP', '서포터'].includes(role)) score += Math.max(10 - (d * 1.5), 2);
            if (['JGL', '정글'].includes(role))   score += Math.max(6 - d, 0);
            if (['TOP', '탑'].includes(role))     score += Math.max(4 - d, 0);
            // MID/ADC get no boost — formula naturally rewards their kill-heavy stats
            playerScores[p.playerName].totalScore += score;
            playerScores[p.playerName].games += 1;
        });
    });
    const sorted = Object.values(playerScores).sort((a, b) => b.totalScore - a.totalScore);
    return sorted[0];
};

// Returns white or black text for best contrast against a background hex color


const getContrastText = (hexColor) => {
    if (!hexColor || hexColor === 'transparent') return '#ffffff';
    const hex = String(hexColor).replace('#', '');
    if (hex.length < 6) return '#ffffff';
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5 ? '#ffffff' : '#000000';
};

const getGlobalTeam = (teamIdentifier, lckTeams, fstTeams = []) => {
    if (!teamIdentifier) return null;
    let found = lckTeams.find(t => t.name === teamIdentifier || String(t.id) === String(teamIdentifier));
    if (found) return found;
    if (fstTeams && fstTeams.length > 0) {
        found = fstTeams.find(t => t.name === teamIdentifier || String(t.fstId) === String(teamIdentifier));
        if (found) return found;
    }
    for (const lg in FOREIGN_LEAGUES) {
        found = (FOREIGN_LEAGUES[lg] || []).find(t => t.name === teamIdentifier || String(t.id) === String(teamIdentifier));
        if (found) return found;
    }
    return null;
};

// --- RoleBadge Component ---
const RoleBadge = ({ role }) => {
    const icons = { TOP: '⚔️', JGL: '🌲', MID: '🧙', ADC: '🏹', SUP: '🛡️' };
    const colors = {
        TOP: 'bg-red-100 text-red-700 border-red-200',
        JGL: 'bg-green-100 text-green-700 border-green-200',
        MID: 'bg-purple-100 text-purple-700 border-purple-200',
        ADC: 'bg-blue-100 text-blue-700 border-blue-200',
        SUP: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${colors[role] || 'bg-gray-100'}`}>
            <span>{icons[role]}</span> {role}
        </span>
    );
};

// --- PlayerCard Component ---
const PlayerCard = ({ player, rank, lckTeams, fstTeams }) => {
    if (!player) return (
        <div className="w-full h-[220px] bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            N/A
        </div>
    );
    
    const playerData = globalPlayerList.find(p => p.이름 === player.playerName || p.playerName === player.playerName);
    const koreanName = playerData ? (playerData.한글명 || playerData.실명 || playerData.이름 || player.playerName) : player.playerName; 
    const ign = player.playerName;

    const teamNameRef = player.teamObj?.name || player.team || (player.teams && player.teams[0]);
    const globalTeam = getGlobalTeam(teamNameRef, lckTeams, fstTeams);
    const displayTeamName = globalTeam?.name || teamNameRef || 'FA';
    
    const bgColor = TEAM_COLORS[displayTeamName] || globalTeam?.colors?.primary || player.teamObj?.colors?.primary || '#333';

    const rankStyles = {
        1: 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white ring-2 ring-yellow-200',
        2: 'border-gray-300 bg-gradient-to-br from-gray-50 to-white ring-1 ring-gray-200',
        3: 'border-orange-300 bg-gradient-to-br from-orange-50 to-white ring-1 ring-orange-200'
    };

    return (
        <div className={`relative w-full p-2 lg:p-3 rounded-xl border shadow-sm flex flex-col items-center gap-2 ${rankStyles[rank]}`}>
            <div className="absolute top-2 left-2 opacity-80 scale-90 origin-top-left z-10">
                <RoleBadge role={player.role} />
            </div>

            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-md mt-4" 
                 style={{ backgroundColor: bgColor, color: getContrastText(bgColor) }}>
                {displayTeamName}
            </div>

            <div className="text-center mb-1">
                <div className="font-black text-gray-900 text-sm lg:text-base leading-tight break-keep">{koreanName}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide truncate max-w-[100px]">{ign}</div>
            </div>

            <div className="w-full text-center mt-auto bg-white/50 rounded-lg p-2 border border-gray-100">
                <div className="text-xl lg:text-2xl font-black text-gray-800 leading-none mb-1">{player.finalScore?.toFixed(0) || 0}</div>
                <div className="text-[10px] text-gray-400 font-bold mb-2">총 점수</div>
                
                <div className="text-[9px] text-gray-500 border-t border-gray-200 pt-1 mt-1">
                    <span className="font-bold hidden lg:inline">(세부 점수)</span>
                    <div className="flex justify-center flex-wrap gap-1 mt-0.5 whitespace-nowrap leading-tight">
                        <span title="팀 성적 점수">팀 {player.rankPoints || 0}</span>
                        <span>+</span>
                        <span title="POG 포인트">POG {(player.pogCount || 0) * 10}</span>
                        <span>+</span>
                        <span title="스탯 평점">지표 {player.avgScore?.toFixed(0) || 0}</span>
                        
                        {player.mvpBonus > 0 && (
                             <><span>+</span><span className="text-yellow-600 font-bold">MVP {player.mvpBonus}</span></>
                        )}
                        {player.isFinalsMvp && (
                            <><span>+</span><span className="text-blue-600 font-bold">FMVP 20</span></>
                        )}
                        {player.isPogLeader && !player.isFinalsMvp && (
                             <><span>+</span><span className="text-green-600 font-bold">POG 20</span></>
                        )}
                         {player.isPogLeader && player.isFinalsMvp && (
                             <><span>+</span><span className="text-green-600 font-bold">POG 20</span></>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MvpShowcaseCard Component ---
const MvpShowcaseCard = ({ player, title, badgeColor, lckTeams, fstTeams, size = 'large' }) => {
    if (!player) return (
        <div className={`relative bg-gray-800 rounded-2xl border border-gray-700 p-8 flex items-center justify-center text-gray-500 font-bold ${size === 'large' ? 'w-full max-w-lg mx-auto' : 'w-full'}`}>
            데이터 없음
        </div>
    );

    const teamNameRef = player.teamObj?.name || player.team || (player.teams && player.teams[0]);
    const globalTeam = getGlobalTeam(teamNameRef, lckTeams, fstTeams);
    const displayTeamName = globalTeam?.name || teamNameRef || 'FA';
    
    const bgColor = TEAM_COLORS[displayTeamName] || globalTeam?.colors?.primary || player.teamObj?.colors?.primary || '#333';

    const pData = globalPlayerList.find(p => p.이름 === player.playerName || p.playerName === player.playerName);
    const realName = pData ? (pData.한글명 || pData.실명 || pData.이름 || player.playerName) : player.playerName;

    return (
        <div className={`relative bg-gradient-to-b from-gray-900 to-gray-800 text-white rounded-2xl shadow-2xl border border-gray-700 overflow-hidden group ${size === 'large' ? 'w-full max-w-lg mx-auto p-8' : 'w-full p-6'}`}>
            <div className="absolute top-0 right-0 p-6 opacity-5 text-[80px] lg:text-[120px] font-black leading-none pointer-events-none select-none">MVP</div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`inline-block text-black font-black text-xs px-3 py-1 rounded-full mb-4 shadow-lg ${badgeColor}`}>
                    {title}
                </div>

                <div className={`rounded-full border-4 flex items-center justify-center font-black shadow-2xl mb-4 relative ${badgeColor.replace('bg-', 'border-')}`}
                     style={{
                         backgroundColor: bgColor,
                         color: getContrastText(bgColor),
                         width: size === 'large' ? '7rem' : '5rem', 
                         height: size === 'large' ? '7rem' : '5rem',
                         fontSize: size === 'large' ? '1.875rem' : '1.5rem'
                     }}>
                    {displayTeamName}
                </div>
                
                <h1 className={`${size === 'large' ? 'text-4xl lg:text-5xl' : 'text-2xl lg:text-3xl'} font-black text-white mb-1 tracking-tight`}>{realName}</h1>
                <div className={`${size === 'large' ? 'text-xl' : 'text-sm'} text-gray-400 font-bold mb-2`}>{player.playerName}</div>
                {player.pogCount !== undefined && (
                    <div className="bg-yellow-500/10 text-yellow-300 font-bold px-3 py-1 rounded-full mb-4 text-sm">
                        POG Counts: {player.pogCount}
                    </div>
                )}
                
                <div className="w-full border-t border-gray-700 pt-3 mt-2">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Total Score</div>
                        <div className={`font-black ${badgeColor.replace('bg-', 'text-').replace('text-black', '')} ${size === 'large' ? 'text-4xl' : 'text-3xl'}`}>
                        {player.finalScore?.toFixed(0) || 0}
                        </div>
                </div>
            </div>
        </div>
    );
};

// --- TeamSection Component ---
const TeamSection = ({ title, rank, players, lckTeams, fstTeams }) => {
    const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const headerStyles = {
        1: 'bg-yellow-500 text-white border-yellow-600',
        2: 'bg-gray-400 text-white border-gray-500',
        3: 'bg-orange-400 text-white border-orange-500'
    };
    
    const safePlayers = players || {};
    
    return (
        <div className="mb-8 last:mb-0">
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`px-3 py-1 rounded-lg font-black text-sm shadow-sm border-b-2 whitespace-nowrap ${headerStyles[rank]}`}>{title}</div>
                <div className="h-px bg-gray-200 flex-1"></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 lg:gap-3 px-1">
                {roles.map(role => ( <PlayerCard key={role} player={safePlayers[role]} rank={rank} lckTeams={lckTeams} fstTeams={fstTeams} /> ))}
            </div>
        </div>
    );
};

// Point scales — defined at module level
const LPL_SCALE  = [100, 90, 80, 70, 65, 60, 55, 50, 40, 30, 20, 10, 5, 0]; // 14 teams
const LEC_SCALE  = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 0];         // 12 teams
const BASE_SCALE = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];                 // 10 teams

// [NEW] FST specific scales based on 8 teams
const FST_GROUP_SCALE = [100, 100, 80, 80, 60, 60, 40, 40];
const FST_PLAYOFF_SCALE = [100, 80, 60, 50, 40, 30, 20, 10];

// Re-calculates ALL player scores from match history using the correct scale
const reapplyScale = (data, matches, standingsNames, scale, forPlayoffs) => {
    if (!data) return data;

    const rankPtsMap = {};
    (standingsNames || []).forEach((name, idx) => {
        if (name) rankPtsMap[name] = idx < scale.length ? scale[idx] : 0;
    });

    const safeArr = v => Array.isArray(v) ? v : [];
    const normalizeRole = (r) => {
        if (!r) return 'UNKNOWN';
        const up = String(r).toUpperCase();
        if (['JGL','정글','JUNGLE'].includes(up)) return 'JGL';
        if (['SUP','서포터','SUPP','SPT'].includes(up)) return 'SUP';
        if (['ADC','원거리','BOT','BOTTOM','AD'].includes(up)) return 'ADC';
        if (['MID','미드'].includes(up)) return 'MID';
        if (['TOP','탑'].includes(up)) return 'TOP';
        return up;
    };

    // Build full player pool from ALL match history
    const players = {};
    const targetMatches = (matches || []).filter(m => {
        if (m.status !== 'finished') return false;
        
        // FST match filtering
        if (m.type === 'fst' || m.fstRound) {
            if (forPlayoffs) return ['PG1', 'PG2', 'Finals'].includes(m.fstRound);
            return m.fstRound && m.fstRound.startsWith('GG');
        }

        // Regular/PO Match filtering
        if (forPlayoffs) return m.type === 'playoff'; 
        return m.type === 'regular' || m.type === 'super';
    });

    for (const match of targetMatches) {
        for (const set of safeArr(match.result?.history)) {
            // Recalculate scores for every player in this set using the new formula
            const allPicks = [...safeArr(set.picks?.A), ...safeArr(set.picks?.B)];
            let bestName = null;
            let bestScore = -Infinity;

            for (const p of allPicks) {
                if (!p?.playerName) continue;
                const name = p.playerName;
                if (!players[name]) players[name] = { games: 0, totalScore: 0, pog: 0, role: null, team: null };
                const k = p.stats?.kills ?? p.k ?? 0;
                const d = p.stats?.deaths ?? p.d ?? 0;
                const a = p.stats?.assists ?? p.a ?? 0;
                const gold = p.currentGold ?? 0;
                const kda = (k * 3 + a * 0.25) / Math.max(d, 1.5);
                let setScore = 65 + kda + (gold / 1500);
                const role = p.role || p.playerData?.포지션 || 'MID';
                if (['SUP', '서포터'].includes(role)) setScore += Math.max(10 - (d * 1.5), 2);
                if (['JGL', '정글'].includes(role))   setScore += Math.max(6 - d, 0);
                if (['TOP', '탑'].includes(role))     setScore += Math.max(4 - d, 0);
                players[name].games++;
                players[name].totalScore += setScore;
                if (!players[name].role) players[name].role = p.role || p.playerData?.포지션;
                if (!players[name].team) players[name].team = p.playerData?.팀 || p.playerData?.team;

                // Track who scores highest on the winning side for POG recalc
                const winnerName = set.winner || set.winnerName || '';
                const playerTeam = p.playerData?.팀 || '';
                const isOnWinningSide = winnerName && playerTeam && (
                    playerTeam === winnerName || playerTeam.includes(winnerName) || winnerName.includes(playerTeam)
                );
                if (isOnWinningSide && setScore > bestScore) {
                    bestScore = setScore;
                    bestName = name;
                }
            }

            // Award POG to the recalculated winner (not the stale stored value)
            if (bestName) {
                if (!players[bestName]) players[bestName] = { games: 0, totalScore: 0, pog: 0, role: null, team: null };
                players[bestName].pog++;
            }
        }
    }

    // Recalculate pure POG Leader
    // Recalculate pure POG Leader
    let maxPog = 0;
    let computedPogLeader = null;
    Object.entries(players).forEach(([name, d]) => {
        if (d.pog > maxPog) {
            maxPog = d.pog;
            computedPogLeader = name;
        } else if (d.pog === maxPog && maxPog > 0) {
            // Tie breaker: total score
            if (d.totalScore > (players[computedPogLeader]?.totalScore || 0)) {
                computedPogLeader = name;
            }
        }
    });

    // --- FALLBACK FOR FINALS MVP (Dynamic Calculation for un-saved FST/LPL Finals) ---
    let fallbackFinalsMvp = null;
    if (forPlayoffs) {
        const finalsMatch = targetMatches.find(m => 
            m.fstRound === 'Finals' ||
            m.id === 'lpl_po14' || m.id === 'lec_po_final' || 
            m.id === 'lcs_po8' || m.id === 'cblol_po10' || 
            (m.round === 4 && m.id?.startsWith('lcp_')) ||
            (m.label && (m.label.trim() === '결승' || m.label.trim() === '결승전' || m.label.toUpperCase() === 'FINAL' || m.label.toUpperCase().includes('GRAND FINAL'))) ||
            (m.roundName && (m.roundName.trim() === '결승' || m.roundName.trim() === '결승전' || m.roundName.toUpperCase().includes('GRAND FINAL')))
        );
        if (finalsMatch && finalsMatch.result?.history && finalsMatch.result?.winner) {
            fallbackFinalsMvp = calculatePOS(finalsMatch.result.history, finalsMatch.result.winner);
        }
    }

    const pogLeaderName = computedPogLeader || data.pogLeader?.playerName || null;
    const finalsMvpName = data.finalsMvp?.playerName || fallbackFinalsMvp?.playerName || null;

    // Score every player with the correct scale

    // Score every player with the correct scale
    const scored = Object.entries(players)
        .filter(([, d]) => d.games > 0)
        .map(([name, d]) => {
            const teamName = d.team || '';
            const rankPoints = rankPtsMap[teamName] ?? 0;
            const avgScore = d.totalScore / d.games;
            const pogCount = d.pog;
            const isPogLeader = name === pogLeaderName;
            const isFinalsMvp = name === finalsMvpName;
            const finalScore = rankPoints + (pogCount * 10) + avgScore
                + (isFinalsMvp ? 20 : 0) + (isPogLeader ? 20 : 0);
            return {
                playerName: name,
                role: normalizeRole(d.role),
                team: teamName, teamObj: { name: teamName },
                rankPoints, avgScore, pogCount,
                isPogLeader, isFinalsMvp, mvpBonus: 0, finalScore,
            };
        })
        .sort((a, b) => b.finalScore - a.finalScore);

    // All-Pro: top 3 per role from full pool
    const ROLES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const allProTeams = { 1: {}, 2: {}, 3: {} };
    const usedByRole = {};
    ROLES.forEach(r => { usedByRole[r] = []; });
    for (const tier of [1, 2, 3]) {
        for (const role of ROLES) {
            const eligible = scored.filter(p => p.role === role && !usedByRole[role].includes(p.playerName));
            if (eligible[0]) { allProTeams[tier][role] = eligible[0]; usedByRole[role].push(eligible[0].playerName); }
        }
    }

    const seasonMvp  = scored[0] || null;
    const pogLeader  = scored.find(p => p.isPogLeader) || null;
    const finalsMvp  = scored.find(p => p.isFinalsMvp) || null;

    return { ...data, seasonMvp, pogLeader, finalsMvp, allProTeams };
};

// --- Main Component ---
export default function AwardsTab({ league, teams, myLeague: myLeagueProp }) {
    const myLeague = myLeagueProp || 'LCK';
    const [currentLeague, setCurrentLeague] = useState(myLeague);
    const [viewMode, setViewMode] = useState('regular'); // 'regular' | 'playoff'
    const [lckPageIndex, setLckPageIndex] = useState(0); // 0 = split1 (if avail) | cup

    const isLCK = currentLeague === 'LCK';
    const isLEC = currentLeague === 'LEC';
    const isLPL = currentLeague === 'LPL';
    const isFST = currentLeague === 'FST';
    
    const activeTeams = isLCK ? teams : (isFST ? (league?.fst?.teams || []) : (FOREIGN_LEAGUES[currentLeague] || []));
    
    const activeLeagueData = useMemo(() => {
        if (isLCK) return league;

        // --- FST MATCH EXTRACTOR ---
        if (isFST) {
            const fstMatches = league?.fst?.matches || [];
            const fstTeams = league?.fst?.teams || [];
            
            const findM = (round) => fstMatches.find(m => m.fstRound === round);
            const getW = (m) => m?.result?.winner;
            const getL = (m) => {
                if (!m?.result?.winner) return null;
                const wName = m.result.winner;
                
                // Get Winner ID
                const wId = fstTeams.find(t => t.name === wName || t.fstId === wName)?.fstId;
                
                let loserId = null;
                if (wId) {
                    loserId = m.t1 === wId ? m.t2 : m.t1;
                } else {
                    const t1Name = fstTeams.find(t => t.fstId === m.t1)?.name;
                    loserId = t1Name === wName ? m.t2 : m.t1;
                }
                
                return fstTeams.find(t => t.fstId === loserId)?.name;
            };

            const getWonSets = (m, teamName) => {
                 if (!m?.result?.score) return 0;
                 const parts = String(m.result.score).split(/[-:]/).map(Number);
                 if (parts.length !== 2) return 0;
                 return getW(m) === teamName ? Math.max(parts[0], parts[1]) : Math.min(parts[0], parts[1]);
            };

            const gg5 = findM('GG5'); const gg6 = findM('GG6');
            const gg7 = findM('GG7'); const gg8 = findM('GG8');
            const gg9 = findM('GG9'); const gg10 = findM('GG10');
            const pg1 = findM('PG1'); const pg2 = findM('PG2');
            const finals = findM('Finals');

            // 1) Group Stage Ranks (Length: 8)
            const groupRanks = [
                 getW(gg5), getW(gg6),   // 100: 2라운드 승자전 Winner
                 getW(gg9), getW(gg10),  // 80:  최종전 Winner
                 getL(gg9), getL(gg10),  // 60:  최종전 Loser
                 getL(gg7), getL(gg8)    // 40:  2라운드 패자전 Loser
            ].filter(Boolean);

            // 2) Playoff Ranks (Length: 8)
            const playoffRanks = [];
            const addP = (n) => { if (n && !playoffRanks.includes(n)) playoffRanks.push(n); };

            addP(getW(finals)); // 1st: Winner of finals
            addP(getL(finals)); // 2nd: Loser of finals
            
            // 3rd / 4th: Loser of PG1 / PG2 — team paired with its own match (not positional)
            // The loser who won more sets (closer match) ranks higher
            const l_pg1 = getL(pg1); const l_pg2 = getL(pg2);
            const pg1Loser = l_pg1 ? { name: l_pg1, setsWon: getWonSets(pg1, l_pg1) } : null;
            const pg2Loser = l_pg2 ? { name: l_pg2, setsWon: getWonSets(pg2, l_pg2) } : null;
            [pg1Loser, pg2Loser].filter(Boolean)
                .sort((a, b) => b.setsWon - a.setsWon)
                .forEach(t => addP(t.name));

            // 5th / 6th: Loser of GG9 / GG10 (3rd in groups)
            const l_gg9 = getL(gg9); const l_gg10 = getL(gg10);
            const gg9Loser = l_gg9 ? { name: l_gg9, setsWon: getWonSets(gg9, l_gg9) } : null;
            const gg10Loser = l_gg10 ? { name: l_gg10, setsWon: getWonSets(gg10, l_gg10) } : null;
            [gg9Loser, gg10Loser].filter(Boolean)
                .sort((a, b) => b.setsWon - a.setsWon)
                .forEach(t => addP(t.name));

            // 7th / 8th: Loser of GG7 / GG8 (4th in groups)
            const l_gg7 = getL(gg7); const l_gg8 = getL(gg8);
            const gg7Loser = l_gg7 ? { name: l_gg7, setsWon: getWonSets(gg7, l_gg7) } : null;
            const gg8Loser = l_gg8 ? { name: l_gg8, setsWon: getWonSets(gg8, l_gg8) } : null;
            [gg7Loser, gg8Loser].filter(Boolean)
                .sort((a, b) => b.setsWon - a.setsWon)
                .forEach(t => addP(t.name));

            // Fallback sweep to catch any missing
            groupRanks.forEach(addP);

            return {
                ...league,
                matches: fstMatches,
                standings: {},
                finalStandings: playoffRanks, 
                regularStandings: groupRanks,
            };
        }

        const foreignMatches = league.foreignMatches?.[currentLeague] || [];
        let customFinalStandingsNames = [];
        let regularStandingsNames = []; 
        let seedStandingsNames = [];

        const playoffSeeds = league.foreignPlayoffSeeds?.[currentLeague] || [];
        if (playoffSeeds.length > 0) {
            seedStandingsNames = [...playoffSeeds]
                .sort((a, b) => a.seed - b.seed)
                .map(s => s.name || s.id);
        }

        if (foreignMatches.length > 0) {
            const currentTeams = FOREIGN_LEAGUES[currentLeague] || [];
            const getLoser = (id) => {
                const m = foreignMatches.find(x => x.id === id);
                if (!m || !m.result?.winner) return null;
                const t1 = getGlobalTeam(m.t1, currentTeams)?.name || m.t1;
                const t2 = getGlobalTeam(m.t2, currentTeams)?.name || m.t2;
                return m.result.winner === t1 ? t2 : t1;
            };
            const getWinner = (id) => {
                const m = foreignMatches.find(x => x.id === id);
                return m?.result?.winner || null;
            };
            const getWinnerByRound = (r, mNum) => foreignMatches.find(x => x.round === r && x.match === mNum)?.result?.winner;
            const getLoserByRound = (r, mNum) => {
                const m = foreignMatches.find(x => x.round === r && x.match === mNum);
                if (!m || !m.result?.winner) return null;
                const t1 = getGlobalTeam(m.t1, currentTeams)?.name || m.t1;
                const t2 = getGlobalTeam(m.t2, currentTeams)?.name || m.t2;
                return m.result.winner === t1 ? t2 : t1;
            };

            const getMatchSetDiff = (id) => {
                const m = foreignMatches.find(x => x.id === id);
                if (!m?.result?.score) return 0;
                const parts = String(m.result.score).split(/[-:]/).map(Number);
                if (parts.length !== 2) return 0;
                return Math.abs(parts[0] - parts[1]);
            };

            const st = {};
            currentTeams.forEach(t => st[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], team: t });

            foreignMatches.filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished').forEach(m => {
                const winner = m.result?.winner;
                const t1 = getGlobalTeam(m.t1, currentTeams)?.name || m.t1;
                const t2 = getGlobalTeam(m.t2, currentTeams)?.name || m.t2;
                const loser = winner === t1 ? t2 : t1;
                let diff = 0;
                if (m.result?.score) {
                    const pts = String(m.result.score).split(/[-:]/).map(Number);
                    if (pts.length === 2 && !isNaN(pts[0]) && !isNaN(pts[1])) diff = Math.abs(pts[0] - pts[1]);
                }
                if (st[winner]) {
                    st[winner].w++; st[winner].diff += diff; st[winner].defeatedOpponents.push(loser);
                    if (!st[winner].h2h[loser]) st[winner].h2h[loser] = { w: 0, l: 0 };
                    st[winner].h2h[loser].w += 1;
                }
                if (st[loser]) {
                    st[loser].l++; st[loser].diff -= diff;
                    if (!st[loser].h2h[winner]) st[loser].h2h[winner] = { w: 0, l: 0 };
                    st[loser].h2h[winner].l += 1;
                }
            });

            const tiedGroups = {};
            Object.values(st).forEach(rec => {
                const key = `${rec.w}_${rec.diff}`;
                if (!tiedGroups[key]) tiedGroups[key] = [];
                tiedGroups[key].push(rec.team.name);
            });

            const regSorted = Object.values(st).sort((a,b) => {
                if (b.w !== a.w) return b.w - a.w; 
                if (b.diff !== a.diff) return b.diff - a.diff; 
                const tieKey = `${a.w}_${a.diff}`;
                const tiedCount = tiedGroups[tieKey]?.length || 0;
                if (tiedCount === 2) {
                    const aWinsVsB = a.h2h[b.team.name]?.w || 0;
                    const bWinsVsA = b.h2h[a.team.name]?.w || 0;
                    if (aWinsVsB !== bWinsVsA) return bWinsVsA - aWinsVsB;
                }
                let sovWinsA = 0, sovDiffA = 0;
                a.defeatedOpponents.forEach(opp => { sovWinsA += (st[opp]?.w || 0); sovDiffA += (st[opp]?.diff || 0); });
                let sovWinsB = 0, sovDiffB = 0;
                b.defeatedOpponents.forEach(opp => { sovWinsB += (st[opp]?.w || 0); sovDiffB += (st[opp]?.diff || 0); });
                if (sovWinsB !== sovWinsA) return sovWinsB - sovWinsA;
                if (sovDiffB !== sovDiffA) return sovDiffB - sovDiffA;
                return 0;
            });

            regularStandingsNames = regSorted.map(r => r.team?.name).filter(Boolean);
            const fallbackStandings = seedStandingsNames.length > 0 ? seedStandingsNames : regularStandingsNames;

            if (currentLeague === 'LPL') {
                const lplRanks = [];
                const addRank = (tName) => { if (tName) lplRanks.push(tName); };

                addRank(getWinner('lpl_po14'));
                addRank(getLoser('lpl_po14'));
                addRank(getLoser('lpl_po13'));
                addRank(getLoser('lpl_po12'));

                const sortTiedPairs = (id1, id2) => {
                    const loserA = getLoser(id1);
                    const loserB = getLoser(id2);
                    const arr = [loserA, loserB].filter(Boolean);
                    return arr.sort((a, b) => {
                        const mIdA = a === loserA ? id1 : id2;
                        const mIdB = b === loserA ? id1 : id2;
                        const diffA = getMatchSetDiff(mIdA);
                        const diffB = getMatchSetDiff(mIdB);
                        if (diffA !== diffB) return diffA - diffB;
                        return fallbackStandings.indexOf(a) - fallbackStandings.indexOf(b);
                    });
                };

                const fifthSixth = sortTiedPairs('lpl_po9', 'lpl_po10');
                fifthSixth.forEach(tName => addRank(tName));

                const seventhEighth = sortTiedPairs('lpl_po7', 'lpl_po8');
                seventhEighth.forEach(tName => addRank(tName));

                const ninthTenth = sortTiedPairs('lpl_pi5', 'lpl_pi6');
                ninthTenth.forEach(tName => addRank(tName));

                const eleventhTwelfth = sortTiedPairs('lpl_pi3', 'lpl_pi4');
                eleventhTwelfth.forEach(tName => addRank(tName));

                const alreadyPlaced = new Set(lplRanks);
                fallbackStandings.filter(x => x && !alreadyPlaced.has(x)).forEach(r => lplRanks.push(r));
                customFinalStandingsNames = lplRanks;

            } else if (currentLeague === 'LCS') {
                const lcsRanks = [];
                const addRank = (tName) => { if (tName) lcsRanks.push(tName); };

                addRank(getWinner('lcs_po8'));
                addRank(getLoser('lcs_po8'));
                addRank(getLoser('lcs_po7'));
                addRank(getLoser('lcs_po6'));

                const r1L1 = getLoser('lcs_po4');
                const r1L2 = getLoser('lcs_po5');
                const fifthSixth = [r1L1, r1L2].filter(Boolean).sort((a, b) => fallbackStandings.indexOf(a) - fallbackStandings.indexOf(b));
                fifthSixth.forEach(tName => addRank(tName));
                addRank(getLoser('lcs_pi1'));

                const alreadyPlaced = new Set(lcsRanks);
                fallbackStandings.filter(x => x && !alreadyPlaced.has(x)).forEach(r => lcsRanks.push(r));
                customFinalStandingsNames = lcsRanks;
                
            } else if (currentLeague === 'CBLOL') {
                const cblolRanks = [];
                const addRank = (tName) => { if (tName) cblolRanks.push(tName); };
                
                addRank(getWinner('cblol_po10'));
                addRank(getLoser('cblol_po10'));
                addRank(getLoser('cblol_po9'));
                addRank(getLoser('cblol_po8'));
                addRank(getLoser('cblol_po7'));
                addRank(getLoser('cblol_po6'));

                const alreadyPlaced = new Set(cblolRanks);
                fallbackStandings.filter(x => x && !alreadyPlaced.has(x)).forEach(r => cblolRanks.push(r));
                customFinalStandingsNames = cblolRanks;

            } else if (currentLeague === 'LCP') {
                const lcpRanks = [];
                const addRank = (tName) => { if (tName) lcpRanks.push(tName); };
                
                addRank(getWinnerByRound(4, 1));
                addRank(getLoserByRound(4, 1));
                addRank(getLoserByRound(3.1, 1));
                addRank(getLoserByRound(2.1, 1));

                const r1L1 = getLoserByRound(1, 1);
                const r1L2 = getLoserByRound(1, 2);
                const fifthSixth = [r1L1, r1L2].filter(Boolean).sort((a, b) => fallbackStandings.indexOf(a) - fallbackStandings.indexOf(b));
                fifthSixth.forEach(tName => addRank(tName));

                const alreadyPlaced = new Set(lcpRanks);
                fallbackStandings.filter(x => x && !alreadyPlaced.has(x)).forEach(r => lcpRanks.push(r));
                customFinalStandingsNames = lcpRanks;

            } else if (currentLeague === 'LEC') {
                const lecRanks = [];
                const addRank = (tName) => { if (tName) lecRanks.push(tName); };

                addRank(getWinner('lec_po_final'));
                addRank(getLoser('lec_po_final'));
                addRank(getLoser('lec_po_r4'));
                addRank(getLoser('lec_po_lbsf'));

                const lb2g1L = getLoser('lec_po_lb2g1');
                const lb2g2L = getLoser('lec_po_lb2g2');
                const fifthSixth = [lb2g1L, lb2g2L].filter(Boolean).sort((a, b) => {
                    const mIdA = a === lb2g1L ? 'lec_po_lb2g1' : 'lec_po_lb2g2';
                    const mIdB = b === lb2g1L ? 'lec_po_lb2g1' : 'lec_po_lb2g2';
                    const diffA = getMatchSetDiff(mIdA);
                    const diffB = getMatchSetDiff(mIdB);
                    if (diffB !== diffA) return diffB - diffA;
                    return fallbackStandings.indexOf(a) - fallbackStandings.indexOf(b);
                });
                fifthSixth.forEach(tName => addRank(tName));

                const lb1g1L = getLoser('lec_po_lb1g1');
                const lb1g2L = getLoser('lec_po_lb1g2');
                const seventhEighth = [lb1g1L, lb1g2L].filter(Boolean).sort((a, b) => {
                    const mIdA = a === lb1g1L ? 'lec_po_lb1g1' : 'lec_po_lb1g2';
                    const mIdB = b === lb1g1L ? 'lec_po_lb1g1' : 'lec_po_lb1g2';
                    const diffA = getMatchSetDiff(mIdA);
                    const diffB = getMatchSetDiff(mIdB);
                    if (diffB !== diffA) return diffB - diffA;
                    return fallbackStandings.indexOf(a) - fallbackStandings.indexOf(b);
                });
                seventhEighth.forEach(tName => addRank(tName));

                const alreadyPlaced = new Set(lecRanks);
                fallbackStandings.filter(x => x && !alreadyPlaced.has(x)).forEach(r => lecRanks.push(r));
                customFinalStandingsNames = lecRanks;
            }
        }

        return {
            ...league,
            matches: foreignMatches,
            standings: league.foreignStandings?.[currentLeague] || {},
            finalStandings: customFinalStandingsNames.length > 0 ? customFinalStandingsNames : (league.finalStandings || []),
            regularStandings: seedStandingsNames.length > 0 ? seedStandingsNames : regularStandingsNames,
        };
    }, [league, currentLeague, isLCK, isLEC, isLPL, isFST, activeTeams]);

    const isPlayoffsFinished = useMemo(() => {
        if (!activeLeagueData.matches) return false;
        
        if (currentLeague === 'FST') {
            const fMatch = activeLeagueData.matches.find(m => m.fstRound === 'Finals');
            return fMatch && fMatch.status === 'finished';
        }

        const playoffs = activeLeagueData.matches.filter(m => m.type === 'playoff');
        if (playoffs.length === 0) return false;

        const explicitFinal = playoffs.find(m => 
            m.round === 5 || 
            String(m.round) === "5" || 
            (currentLeague === 'LPL' && m.id === 'lpl_po14') ||
            (currentLeague === 'LCP' && m.round === 4) ||
            (currentLeague === 'LCS' && m.id === 'lcs_po8') ||
            (currentLeague === 'CBLOL' && m.id === 'cblol_po10') ||
            (currentLeague === 'LEC' && m.id === 'lec_po_final') ||
            (m.label && (m.label.trim() === '결승전' || m.label.toUpperCase() === 'GRAND FINAL'))
        );

        if (explicitFinal) {
            return explicitFinal.status === 'finished';
        }

        return playoffs.every(m => m.status === 'finished');
    }, [activeLeagueData, currentLeague]);

    // All non-LCK leagues must go through reapplyScale — statsManager's rank-point
    // logic is built for LCK's numeric team IDs and returns 0 for foreign name strings.
    const hasCustomScale = !isLCK;

    const customRegularLeagueData = useMemo(() => {
        if (!hasCustomScale) return null;
        const currentScale = isLPL ? LPL_SCALE : (isLEC ? LEC_SCALE : (isFST ? FST_GROUP_SCALE : BASE_SCALE));
        return {
            ...activeLeagueData,
            finalStandings: activeLeagueData.regularStandings || [],
            customRankPointScale: currentScale,
        };
    }, [hasCustomScale, activeLeagueData, isLPL, isLEC, isFST]);

    const customPlayoffLeagueData = useMemo(() => {
        if (!hasCustomScale) return null;
        const currentScale = isLPL ? LPL_SCALE : (isLEC ? LEC_SCALE : (isFST ? FST_PLAYOFF_SCALE : BASE_SCALE));
        return {
            ...activeLeagueData,
            finalStandings: activeLeagueData.finalStandings || [],
            customRankPointScale: currentScale,
        };
    }, [hasCustomScale, activeLeagueData, isLPL, isLEC, isFST]);

    const regularData = useMemo(() => {
        const data = hasCustomScale ? customRegularLeagueData : activeLeagueData;
        const result = computeAwards(data, activeTeams);
        if (hasCustomScale) {
            const currentScale = isLPL ? LPL_SCALE : (isLEC ? LEC_SCALE : (isFST ? FST_GROUP_SCALE : BASE_SCALE));
            return reapplyScale(result, activeLeagueData.matches, activeLeagueData.regularStandings || [], currentScale, false);
        }
        return result;
    }, [hasCustomScale, customRegularLeagueData, activeLeagueData, activeTeams, isLPL, isLEC, isFST]);

    const playoffData = useMemo(() => {
        if (!isPlayoffsFinished) return null;
        const data = hasCustomScale ? customPlayoffLeagueData : activeLeagueData;
        const result = computePlayoffAwards(data, activeTeams);
        if (hasCustomScale) {
            const currentScale = isLPL ? LPL_SCALE : (isLEC ? LEC_SCALE : (isFST ? FST_PLAYOFF_SCALE : BASE_SCALE));
            return reapplyScale(result, activeLeagueData.matches, activeLeagueData.finalStandings || [], currentScale, true);
        }
        return result;
    }, [hasCustomScale, customPlayoffLeagueData, activeLeagueData, activeTeams, isPlayoffsFinished, isLPL, isLEC, isFST]);

    // ── LCK Phase Detection & Split ──────────────────────────────────────
    const hasSplit1Matches = useMemo(() => {
        if (!isLCK) return false;
        return (league?.matches || []).some(m => {
            const month = parseInt((m.date || '').split('.')[0]);
            return !isNaN(month) && month >= 4;
        });
    }, [isLCK, league]);

    // Pages: split1 shown first when available; cup is always present
    const lckPages = useMemo(() => {
        const pages = [];
        if (hasSplit1Matches) pages.push({ id: 'split1', label: 'LCK 정규시즌 어워즈' });
        pages.push({ id: 'cup', label: 'LCK 컵 어워즈' });
        return pages;
    }, [hasSplit1Matches]);

    const safeLckIndex    = Math.min(lckPageIndex, lckPages.length - 1);
    const currentLckId    = lckPages[safeLckIndex]?.id || 'cup';
    const isOnSplit1Page  = currentLckId === 'split1';

    // Filtered league data per LCK phase (cup = months 1-3, split1 = months 4+)
    const lckCupLeagueData = useMemo(() => {
        if (!isLCK) return null;
        const cupMatches = (league?.matches || []).filter(m => {
            const month = parseInt((m.date || '').split('.')[0]);
            return isNaN(month) || month <= 3;
        });
        return { ...league, matches: cupMatches };
    }, [isLCK, league]);

    const lckSplit1LeagueData = useMemo(() => {
        if (!isLCK || !hasSplit1Matches) return null;
        const s1Matches = (league?.matches || []).filter(m => {
            const month = parseInt((m.date || '').split('.')[0]);
            return !isNaN(month) && month >= 4;
        });
        return { ...league, matches: s1Matches };
    }, [isLCK, hasSplit1Matches, league]);

    // ── LCK Cup awards ───────────────────────────────────────────────────
    const lckCupRegularData = useMemo(() => {
        if (!isLCK || !lckCupLeagueData) return null;
        return computeAwards(lckCupLeagueData, teams);
    }, [isLCK, lckCupLeagueData, teams]);

    const lckCupPOFinished = useMemo(() => {
        if (!isLCK || !lckCupLeagueData) return false;
        const po = (lckCupLeagueData.matches || []).filter(m => m.type === 'playoff');
        return po.length > 0 && po.every(m => m.status === 'finished');
    }, [isLCK, lckCupLeagueData]);

    const lckCupPlayoffData = useMemo(() => {
        if (!isLCK || !lckCupPOFinished || !lckCupLeagueData) return null;
        return computePlayoffAwards(lckCupLeagueData, teams);
    }, [isLCK, lckCupPOFinished, lckCupLeagueData, teams]);

    // ── LCK Split 1 awards ───────────────────────────────────────────────
    const lckSplit1RegularData = useMemo(() => {
        if (!isLCK || !lckSplit1LeagueData) return null;
        return computeAwards(lckSplit1LeagueData, teams);
    }, [isLCK, lckSplit1LeagueData, teams]);

    const lckSplit1POFinished = useMemo(() => {
        if (!isLCK || !lckSplit1LeagueData) return false;
        const po = (lckSplit1LeagueData.matches || []).filter(m => m.type === 'playoff');
        return po.length > 0 && po.every(m => m.status === 'finished');
    }, [isLCK, lckSplit1LeagueData]);

    const lckSplit1PlayoffData = useMemo(() => {
        if (!isLCK || !lckSplit1POFinished || !lckSplit1LeagueData) return null;
        return computePlayoffAwards(lckSplit1LeagueData, teams);
    }, [isLCK, lckSplit1POFinished, lckSplit1LeagueData, teams]);

    // ── Resolve active data (LCK uses page-specific data; others use existing) ──
    const resolvedIsPlayoffsFinished = isLCK
        ? (isOnSplit1Page ? lckSplit1POFinished : lckCupPOFinished)
        : isPlayoffsFinished;

    const resolvedRegularData = isLCK
        ? (isOnSplit1Page ? lckSplit1RegularData : lckCupRegularData)
        : regularData;

    const resolvedPlayoffData = isLCK
        ? (isOnSplit1Page ? lckSplit1PlayoffData : lckCupPlayoffData)
        : playoffData;

    const activeData = (viewMode === 'playoff' && resolvedPlayoffData) ? resolvedPlayoffData : resolvedRegularData;

    const isFstTab = currentLeague === 'FST';

    // Title & team-section prefix
    const pageTitle = isLCK
        ? (lckPages[safeLckIndex]?.label || 'LCK 컵 어워즈')
        : (isFstTab ? 'FST World Tournament' : `${currentLeague} Awards`);

    const teamSectionPrefix = isLCK
        ? (isOnSplit1Page ? '정규시즌' : '컵')
        : currentLeague;

    return (
        <div className="p-2 lg:p-6 max-w-7xl mx-auto space-y-8">

            {/* League tabs */}
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 rounded-lg mb-4">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL', ...(league?.fst ? ['FST'] : [])].map(lg => (
                    <button
                        key={lg}
                        onClick={() => {
                            setCurrentLeague(lg);
                            setViewMode('regular');
                        }}
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

            {/* LCK page navigator (< >) */}
            {isLCK && lckPages.length > 1 && (
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => { setLckPageIndex(Math.max(0, safeLckIndex - 1)); setViewMode('regular'); }}
                        disabled={safeLckIndex === 0}
                        className="w-9 h-9 rounded-full bg-gray-100 border border-gray-300 hover:bg-gray-200 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center text-lg font-black text-gray-700 transition active:scale-90"
                    >
                        ‹
                    </button>
                    <div className="flex gap-1.5">
                        {lckPages.map((p, i) => (
                            <button
                                key={p.id}
                                onClick={() => { setLckPageIndex(i); setViewMode('regular'); }}
                                className={`px-4 py-1.5 rounded-full text-xs font-black transition-all border ${
                                    i === safeLckIndex
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-105'
                                        : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => { setLckPageIndex(Math.min(lckPages.length - 1, safeLckIndex + 1)); setViewMode('regular'); }}
                        disabled={safeLckIndex === lckPages.length - 1}
                        className="w-9 h-9 rounded-full bg-gray-100 border border-gray-300 hover:bg-gray-200 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center text-lg font-black text-gray-700 transition active:scale-90"
                    >
                        ›
                    </button>
                </div>
            )}

            {/* Title + regular/playoff toggle */}
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-center space-y-1">
                    <h2 className="text-3xl lg:text-4xl font-black text-gray-900 tracking-tighter">
                        <span className="text-blue-600">2026</span>{' '}
                        {isLCK
                            ? <span className="uppercase">{pageTitle}</span>
                            : (isFstTab ? 'FST World Tournament' : <span className="uppercase">{pageTitle}</span>)
                        }
                    </h2>
                    <p className="text-gray-500 text-sm font-medium">
                        {viewMode === 'playoff'
                            ? (isFstTab ? '플레이오프 성적' : 'Playoffs & Finals Performance')
                            : (isFstTab ? '그룹 스테이지 성적' : 'Regular Season Performance')}
                    </p>
                </div>

                {resolvedIsPlayoffsFinished && (
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                        <button onClick={() => setViewMode('regular')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'regular' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                            {isFstTab ? '그룹 스테이지' : '정규 시즌'}
                        </button>
                        <button onClick={() => setViewMode('playoff')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'playoff' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                            플레이오프
                        </button>
                    </div>
                )}
            </div>

            {/* Main awards content */}
            {!activeData || (!activeData.seasonMvp && viewMode === 'regular') || (!activeData.pogLeader && viewMode === 'playoff') ? (
                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-20 text-gray-400">
                    <div className="text-5xl mb-4 opacity-50">🏆</div>
                    <div className="text-xl font-bold">수상자 데이터 없음</div>
                    <p className="mt-2 text-sm">
                        {isLCK
                            ? `${lckPages[safeLckIndex]?.label || ''} ${viewMode === 'playoff' ? '플레이오프' : '시즌'} 경기가 충분히 진행되지 않았습니다.`
                            : `${currentLeague} ${viewMode === 'playoff' ? '플레이오프' : '시즌'} 경기가 충분히 진행되지 않았습니다.`
                        }
                    </p>
                </div>
            ) : (
                <>
                    <div className="w-full">
                        {viewMode === 'regular' ? (
                            <MvpShowcaseCard
                                player={activeData.seasonMvp}
                                title={isFstTab ? "GROUP STAGE MVP" : "SEASON MVP"}
                                badgeColor="bg-yellow-500 text-black"
                                lckTeams={teams}
                                fstTeams={league?.fst?.teams || []}
                                size="large"
                            />
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 max-w-5xl mx-auto">
                                <MvpShowcaseCard
                                    player={activeData.pogLeader}
                                    title="PLAYOFF MVP"
                                    badgeColor="bg-green-400 text-black"
                                    lckTeams={teams}
                                    fstTeams={league?.fst?.teams || []}
                                    size="medium"
                                />
                                <MvpShowcaseCard
                                    player={activeData.finalsMvp}
                                    title="FINALS MVP"
                                    badgeColor="bg-blue-400 text-black"
                                    lckTeams={teams}
                                    fstTeams={league?.fst?.teams || []}
                                    size="medium"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <TeamSection title={viewMode === 'playoff' ? `All-LCK ${teamSectionPrefix} Playoff 1st Team` : `All-LCK ${teamSectionPrefix} 1st Team`} rank={1} players={activeData.allProTeams?.[1]} lckTeams={teams} fstTeams={league?.fst?.teams || []} />
                        <TeamSection title={viewMode === 'playoff' ? `All-LCK ${teamSectionPrefix} Playoff 2nd Team` : `All-LCK ${teamSectionPrefix} 2nd Team`} rank={2} players={activeData.allProTeams?.[2]} lckTeams={teams} fstTeams={league?.fst?.teams || []} />
                        <TeamSection title={viewMode === 'playoff' ? `All-LCK ${teamSectionPrefix} Playoff 3rd Team` : `All-LCK ${teamSectionPrefix} 3rd Team`} rank={3} players={activeData.allProTeams?.[3]} lckTeams={teams} fstTeams={league?.fst?.teams || []} />
                    </div>
                </>
            )}
        </div>
    );
}