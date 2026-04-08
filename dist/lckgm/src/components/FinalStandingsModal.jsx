// src/components/FinalStandingsModal.jsx
import React, { useMemo } from 'react';
import { calculateFinalStandings } from '../engine/BracketManager';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';
import { TEAM_COLORS } from '../data/constants';

const FinalStandingsModal = ({ league, myLeague = 'LCK', teams = [], onClose }) => {
    // Safety check
    if (!league) return null;

    const standings = useMemo(() => {
        try {
            const lg = myLeague || league?.myLeague || 'LCK';

            // ── LCK ─────────────────────────────────────────────────────────
            if (lg === 'LCK') {
                // BracketManager already returns ordered objects for LCK
                return calculateFinalStandings(league) || [];
            }

            // ── Foreign leagues: mirror AwardsTab final standings logic ─────
            const foreignMatches = league.foreignMatches?.[lg] || [];
            const currentTeams = FOREIGN_LEAGUES[lg] || [];
            const playoffSeeds = league.foreignPlayoffSeeds?.[lg] || [];

            const resolveTeamName = (token) => {
                if (!token || token === 'TBD' || token === 'null' || token === 'undefined') return null;
                const s = String(token);
                const found = currentTeams.find(t => String(t.id) === s || String(t.name) === s);
                return found?.name || s;
            };
            const getGlobalTeam = (teamIdentifier) => {
                if (!teamIdentifier) return null;
                const name = resolveTeamName(teamIdentifier);
                return currentTeams.find(t => t.name === name || String(t.id) === String(teamIdentifier)) || null;
            };

            const getWinner = (id) => foreignMatches.find(x => x.id === id)?.result?.winner || null;
            const getLoser = (id) => {
                const m = foreignMatches.find(x => x.id === id);
                if (!m || !m.result?.winner) return null;
                const t1 = resolveTeamName(m.t1);
                const t2 = resolveTeamName(m.t2);
                const w = resolveTeamName(m.result.winner);
                if (!t1 || !t2 || !w) return null;
                return w === t1 ? t2 : t1;
            };
            const getWinnerByRound = (r, mNum) => foreignMatches.find(x => x.round === r && x.match === mNum)?.result?.winner;
            const getLoserByRound = (r, mNum) => {
                const m = foreignMatches.find(x => x.round === r && x.match === mNum);
                if (!m || !m.result?.winner) return null;
                const t1 = resolveTeamName(m.t1);
                const t2 = resolveTeamName(m.t2);
                const w = resolveTeamName(m.result.winner);
                if (!t1 || !t2 || !w) return null;
                return w === t1 ? t2 : t1;
            };
            const getMatchSetDiff = (id) => {
                const m = foreignMatches.find(x => x.id === id);
                if (!m?.result?.score) return 0;
                const parts = String(m.result.score).split(/[-:]/).map(Number);
                if (parts.length !== 2) return 0;
                return Math.abs(parts[0] - parts[1]);
            };

            // fallback standings order = seed order if present, else regular standings order
            const seedStandingsNames = playoffSeeds.length > 0
                ? [...playoffSeeds].sort((a, b) => a.seed - b.seed).map(s => s.name || s.id).filter(Boolean).map(resolveTeamName).filter(Boolean)
                : [];

            const buildRegularStandings = () => {
                const st = {};
                currentTeams.forEach(t => st[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], team: t });
                foreignMatches
                    .filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished' && m.result?.winner)
                    .forEach(m => {
                        const winner = resolveTeamName(m.result.winner);
                        const t1 = resolveTeamName(m.t1);
                        const t2 = resolveTeamName(m.t2);
                        if (!winner || !t1 || !t2) return;
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

                const regSorted = Object.values(st).sort((a, b) => {
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
                return regSorted.map(r => r.team?.name).filter(Boolean);
            };

            const regularStandingsNames = buildRegularStandings();
            const fallbackStandings = (seedStandingsNames.length > 0 ? seedStandingsNames : regularStandingsNames);

            // If playoffs are not finished, return empty (modal shouldn't open normally)
            const hasFinishedFinal = (() => {
                if (lg === 'LEC') return foreignMatches.some(m => m.id === 'lec_po_final' && m.status === 'finished');
                if (lg === 'LPL') return foreignMatches.some(m => m.id === 'lpl_po14' && m.status === 'finished');
                if (lg === 'LCS') return foreignMatches.some(m => m.id === 'lcs_po8' && m.status === 'finished');
                if (lg === 'CBLOL') return foreignMatches.some(m => m.id === 'cblol_po10' && m.status === 'finished');
                if (lg === 'LCP') return foreignMatches.some(m => m.type === 'playoff' && Number(m.round) === 4 && m.status === 'finished');
                return foreignMatches.some(m => m.type === 'playoff' && Number(m.round) === 5 && m.status === 'finished');
            })();
            if (!hasFinishedFinal) return [];

            let finalNames = [];
            const addRank = (tName) => {
                const n = resolveTeamName(tName);
                if (n && !finalNames.includes(n)) finalNames.push(n);
            };

            if (lg === 'LPL') {
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
                        return fallbackStandings.indexOf(resolveTeamName(a)) - fallbackStandings.indexOf(resolveTeamName(b));
                    });
                };
                sortTiedPairs('lpl_po9', 'lpl_po10').forEach(addRank);
                sortTiedPairs('lpl_po7', 'lpl_po8').forEach(addRank);
                sortTiedPairs('lpl_pi5', 'lpl_pi6').forEach(addRank);
                sortTiedPairs('lpl_pi3', 'lpl_pi4').forEach(addRank);
            } else if (lg === 'LCS') {
                addRank(getWinner('lcs_po8'));
                addRank(getLoser('lcs_po8'));
                addRank(getLoser('lcs_po7'));
                addRank(getLoser('lcs_po6'));
                const r1L1 = getLoser('lcs_po4');
                const r1L2 = getLoser('lcs_po5');
                [r1L1, r1L2].filter(Boolean).sort((a, b) =>
                    fallbackStandings.indexOf(resolveTeamName(a)) - fallbackStandings.indexOf(resolveTeamName(b))
                ).forEach(addRank);
                addRank(getLoser('lcs_pi1'));
            } else if (lg === 'CBLOL') {
                addRank(getWinner('cblol_po10'));
                addRank(getLoser('cblol_po10'));
                addRank(getLoser('cblol_po9'));
                addRank(getLoser('cblol_po8'));
                addRank(getLoser('cblol_po7'));
                addRank(getLoser('cblol_po6'));
            } else if (lg === 'LCP') {
                addRank(getWinnerByRound(4, 1));
                addRank(getLoserByRound(4, 1));
                addRank(getLoserByRound(3.1, 1));
                addRank(getLoserByRound(2.1, 1));
                const r1L1 = getLoserByRound(1, 1);
                const r1L2 = getLoserByRound(1, 2);
                [r1L1, r1L2].filter(Boolean).sort((a, b) =>
                    fallbackStandings.indexOf(resolveTeamName(a)) - fallbackStandings.indexOf(resolveTeamName(b))
                ).forEach(addRank);
            } else if (lg === 'LEC') {
                addRank(getWinner('lec_po_final'));
                addRank(getLoser('lec_po_final'));
                addRank(getLoser('lec_po_r4'));
                addRank(getLoser('lec_po_lbsf'));

                const lb2g1L = getLoser('lec_po_lb2g1');
                const lb2g2L = getLoser('lec_po_lb2g2');
                [lb2g1L, lb2g2L].filter(Boolean).sort((a, b) => {
                    const mIdA = a === lb2g1L ? 'lec_po_lb2g1' : 'lec_po_lb2g2';
                    const mIdB = b === lb2g1L ? 'lec_po_lb2g1' : 'lec_po_lb2g2';
                    const diffA = getMatchSetDiff(mIdA);
                    const diffB = getMatchSetDiff(mIdB);
                    if (diffB !== diffA) return diffB - diffA;
                    return fallbackStandings.indexOf(resolveTeamName(a)) - fallbackStandings.indexOf(resolveTeamName(b));
                }).forEach(addRank);

                const lb1g1L = getLoser('lec_po_lb1g1');
                const lb1g2L = getLoser('lec_po_lb1g2');
                [lb1g1L, lb1g2L].filter(Boolean).sort((a, b) => {
                    const mIdA = a === lb1g1L ? 'lec_po_lb1g1' : 'lec_po_lb1g2';
                    const mIdB = b === lb1g1L ? 'lec_po_lb1g1' : 'lec_po_lb1g2';
                    const diffA = getMatchSetDiff(mIdA);
                    const diffB = getMatchSetDiff(mIdB);
                    if (diffB !== diffA) return diffB - diffA;
                    return fallbackStandings.indexOf(resolveTeamName(a)) - fallbackStandings.indexOf(resolveTeamName(b));
                }).forEach(addRank);
            }

            // Fill remaining teams in a stable order (same pattern as AwardsTab)
            const alreadyPlaced = new Set(finalNames);
            fallbackStandings.filter(x => x && !alreadyPlaced.has(resolveTeamName(x))).forEach(addRank);

            // Convert into modal row objects similar to LCK output
            return finalNames.map((name, idx) => {
                const teamObj = getGlobalTeam(name) || { name, fullName: name };
                const color = TEAM_COLORS[teamObj.name] || TEAM_COLORS[name] || '#333';
                return {
                    rank: idx + 1,
                    team: {
                        id: teamObj.id || teamObj.name || name,
                        name: teamObj.name || name,
                        fullName: teamObj.fullName || teamObj.name || name,
                        colors: { primary: color }
                    }
                };
            });
        } catch (err) {
            console.error('[FinalStandingsModal] standings compute failed:', err);
            return [];
        }
    }, [league, myLeague, teams]);
        
    return (
        <div className="absolute inset-0 z-[999] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gray-900 p-4 sm:p-6 text-center relative flex-shrink-0">
                    <h2 className="text-xl sm:text-3xl font-black text-yellow-400">🏆 2026 {myLeague} FINAL</h2>
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-white font-bold text-sm sm:text-base"
                    >
                        ✕ 닫기
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="overflow-y-auto bg-white flex-1">
                    <table className="w-full text-left">
                        <thead className="bg-gray-100 border-b sticky top-0 z-10">
                            <tr>
                                <th className="p-3 sm:p-4 text-center w-12 sm:w-20 text-xs sm:text-base font-bold text-gray-600">순위</th>
                                <th className="p-3 sm:p-4 text-xs sm:text-base font-bold text-gray-600">팀</th>
                                <th className="p-3 sm:p-4 text-right text-xs sm:text-base font-bold text-gray-600">상금 (확정)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {standings.length > 0 ? standings.map((item) => (
                                <tr key={item.team.id} className={`${item.rank === 1 ? 'bg-yellow-50' : 'bg-white'}`}>
                                    <td className="p-2 sm:p-4 text-center">
                                        {item.rank === 1 ? <span className="text-xl sm:text-2xl">🥇</span> : 
                                         item.rank === 2 ? <span className="text-xl sm:text-2xl">🥈</span> : 
                                         item.rank === 3 ? <span className="text-xl sm:text-2xl">🥉</span> : 
                                         <span className="font-bold text-gray-500 text-sm sm:text-lg">{item.rank}위</span>}
                                    </td>
                                    <td className="p-2 sm:p-4 flex items-center gap-2 sm:gap-4">
                                        <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-xs sm:text-lg flex-shrink-0" 
                                             style={{backgroundColor: item.team.colors?.primary || '#333'}}>
                                            {item.team.name}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-black text-sm sm:text-xl text-gray-800 flex items-center gap-1 sm:gap-2 flex-wrap">
                                                <span className="truncate">{item.team.fullName}</span>
                                                {item.rank <= 2 && (
                                                    <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse whitespace-nowrap">
                                                        FST 진출
                                                    </span>
                                                )}
                                            </div>
                                            {item.rank === 1 && <div className="text-[10px] sm:text-xs font-bold text-yellow-600 bg-yellow-100 inline-block px-1.5 py-0.5 rounded mt-0.5 sm:mt-1">CHAMPION</div>}
                                        </div>
                                    </td>
                                    <td className="p-2 sm:p-4 text-right font-bold text-gray-600 text-xs sm:text-base whitespace-nowrap">
                                        {item.rank === 1 ? '0.5억' : 
                                         item.rank === 2 ? '0.25억' : 
                                         item.rank === 3 ? '0.2억' : '0.1억'}
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="3" className="p-8 text-center text-gray-500">순위 데이터 계산 중 오류가 발생했습니다.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="p-3 sm:p-4 bg-gray-50 text-center border-t flex-shrink-0">
                    <button onClick={onClose} className="px-6 sm:px-8 py-2 sm:py-3 bg-gray-800 text-white font-bold text-sm sm:text-base rounded-xl hover:bg-gray-700 shadow-lg transition transform hover:-translate-y-0.5 active:translate-y-0">
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FinalStandingsModal;