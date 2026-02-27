// src/components/HistoryTab.jsx
import React, { useState, useMemo } from 'react';
import { teams } from '../data/teams';
import { FOREIGN_LEAGUES, FOREIGN_PLAYERS } from '../data/foreignLeagues';
import { TEAM_COLORS } from '../data/constants';

const LEAGUE_TITLES = {
    'LCK': '컵',
    'LPL': '스플릿 1',
    'LCP': '스플릿 1',
    'LEC': '버서스',
    'LCS': '락 인',
    'CBLOL': '레전드 컵'
};

// Safely combine every player in the world into one giant phonebook
const globalPlayerList = Object.values(FOREIGN_PLAYERS || {}).flat().filter(Boolean);

// --- Helpers ---
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

// Force Korean Names Globally
const getKoreanName = (playerName) => {
    if (!playerName) return 'Unknown';
    const p = globalPlayerList.find(x => x.이름 === playerName || x.playerName === playerName);
    return p ? (p.한글명 || p.실명 || p.이름 || playerName) : playerName;
};

// Omni-Search Team Finder
const findGlobalTeam = (token) => {
    if (!token || token === 'TBD' || token === 'null') return { name: 'TBD' };
    const s = String(token).trim().toUpperCase();
    const pool = [...teams, ...Object.values(FOREIGN_LEAGUES).flat()];
    const found = pool.find(t =>
        (t.id && String(t.id).toUpperCase() === s) ||
        (t.name && String(t.name).toUpperCase() === s) ||
        (t.fullName && String(t.fullName).toUpperCase() === s)
    );
    return found || { name: String(token) };
};

const HistoryTab = ({ league }) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');

    // --- LCP STANDINGS LOGIC ---
    const lcpFinalStandings = useMemo(() => {
        if (currentLeague !== 'LCP') return null;
        const matches = league.foreignMatches?.['LCP'] || [];
        const playoffs = matches.filter(m => m.type === 'playoff');
        const regular = matches.filter(m => m.type !== 'playoff' && m.status === 'finished');

        // Check if playoffs are fully finished
        if (playoffs.length === 0 || playoffs.some(m => m.status !== 'finished')) return null;

        const findM = (round) => playoffs.find(m => m.round === round);
        const findMNum = (round, num) => playoffs.find(m => m.round === round && m.match === num);

        const getWinner = (m) => (m && m.result?.winner) ? String(m.result.winner).toUpperCase() : null;
        const getLoser = (m) => {
            if (!m || !m.result?.winner) return null;
            const w = String(m.result.winner).toUpperCase();
            const t1 = findGlobalTeam(m.t1).name.toUpperCase();
            const t2 = findGlobalTeam(m.t2).name.toUpperCase();
            if (t1 === w) return findGlobalTeam(m.t2).name;
            if (t2 === w) return findGlobalTeam(m.t1).name;
            return null;
        };

        const r4 = findM(4);         // Finals
        const r3_1 = findM(3.1);     // 결승 진출전
        const r2_1 = findM(2.1);     // 패자조 1라운드
        const r1_1 = findMNum(1, 1); // 1라운드 Match 1
        const r1_2 = findMNum(1, 2); // 1라운드 Match 2

        const first = findGlobalTeam(getWinner(r4)).name;
        const second = getLoser(r4);
        const third = getLoser(r3_1);
        const fourth = getLoser(r2_1);

        const loser1 = getLoser(r1_1);
        const loser2 = getLoser(r1_2);

        // Sort 5th/6th by sets won in their playoff match
        const getLoserWins = (m) => {
            if(!m || !m.result || !m.result.score) return 0;
            const pts = String(m.result.score).split(/[-:]/).map(s => parseInt(s.trim()));
            return Math.min(pts[0] || 0, pts[1] || 0);
        };
        const l1Wins = getLoserWins(r1_1);
        const l2Wins = getLoserWins(r1_2);
        
        let fifth = loser1, sixth = loser2;
        if (l1Wins < l2Wins) { fifth = loser2; sixth = loser1; }

        const top6 = [first, second, third, fourth, fifth, sixth].filter(Boolean);
        
        // Compute 7th/8th based on Regular Season Record
        const allLcpTeams = (FOREIGN_LEAGUES['LCP'] || []).map(t => t.name);
        const remaining = allLcpTeams.filter(t => !top6.includes(t));

        const st = {};
        remaining.forEach(t => st[t] = { w: 0, diff: 0, name: t});
        
        regular.forEach(m => {
            if(m.status !== 'finished') return;
            const w = m.result.winner;
            const pts = String(m.result.score).split(/[-:]/).map(Number);
            const diff = Math.abs(pts[0] - pts[1]);
            
            if (st[w]) { st[w].w++; st[w].diff += diff; }
            
            const l = (findGlobalTeam(m.t1).name === w) ? findGlobalTeam(m.t2).name : findGlobalTeam(m.t1).name;
            if (st[l]) { st[l].diff -= diff; }
        });
        
        remaining.sort((a,b) => {
            if(st[b].w !== st[a].w) return st[b].w - st[a].w;
            return st[b].diff - st[a].diff;
        });

        const seventh = remaining[0];
        const eighth = remaining[1];

        return [
            { rank: 1, team: findGlobalTeam(first) },
            { rank: 2, team: findGlobalTeam(second) },
            { rank: 3, team: findGlobalTeam(third) },
            { rank: 4, team: findGlobalTeam(fourth) },
            { rank: 5, team: findGlobalTeam(fifth) },
            { rank: 6, team: findGlobalTeam(sixth) },
            { rank: 7, team: findGlobalTeam(seventh) },
            { rank: 8, team: findGlobalTeam(eighth) }
        ].filter(x => x.team && x.team.name !== 'TBD');
    }, [currentLeague, league.foreignMatches]);

    // --- RENDER HELPERS ---
    const renderLeagueHistory = () => {
        let isFinished = false;
        let finalStandings = [];
        let championTeam = null;
        let championRoster = [];

        if (currentLeague === 'LCK') {
            const summary = league.seasonSummary;
            if (summary) {
                isFinished = true;
                finalStandings = summary.finalStandings || [];
                championTeam = findGlobalTeam(finalStandings[0]?.id);
                championRoster = championTeam ? globalPlayerList.filter(p => p.팀 === championTeam.name) : [];
            }
        } else if (currentLeague === 'LCP') {
            if (lcpFinalStandings) {
                isFinished = true;
                finalStandings = lcpFinalStandings;
                championTeam = lcpFinalStandings[0]?.team;
                championRoster = championTeam ? globalPlayerList.filter(p => p.팀 === championTeam.name) : [];
            }
        } else {
            return (
                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-20 text-gray-400">
                    <div className="text-4xl lg:text-6xl mb-3 lg:mb-4 animate-bounce">🌍</div>
                    <div className="text-xl lg:text-2xl font-black text-gray-600">{currentLeague} 기록 준비 중</div>
                </div>
            );
        }

        if (!isFinished) {
            return (
                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-20 text-gray-400">
                    <div className="text-5xl mb-4 opacity-50">🏆</div>
                    <div className="text-xl font-bold">시즌이 아직 완료되지 않았습니다</div>
                    <p className="mt-2 text-sm">플레이오프 결승전이 종료되면 기록이 해금됩니다.</p>
                </div>
            );
        }

        const champColor = TEAM_COLORS[championTeam?.name] || championTeam?.colors?.primary || '#3b82f6';

        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* 챔피언 팀 로스터 (Left Column) */}
                <div className="lg:col-span-1 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700 shadow-xl overflow-hidden flex flex-col relative">
                    <div className="absolute top-0 right-0 p-6 opacity-5 text-8xl font-black text-white pointer-events-none">V1</div>
                    <div className="p-6 pb-4 border-b border-gray-700 relative z-10">
                        <div className="text-yellow-400 font-bold text-xs mb-1 tracking-widest uppercase">2026 {currentLeague} {LEAGUE_TITLES[currentLeague]} Champion</div>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full border-2 border-white/20 shadow-lg flex items-center justify-center text-white font-black text-sm" 
                                 style={{backgroundColor: champColor}}>
                                {championTeam?.name}
                            </div>
                            <h3 className="text-2xl font-black text-white">{championTeam?.fullName || championTeam?.name}</h3>
                        </div>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col justify-center space-y-3 z-10">
                        <h4 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-wider">Championship Roster</h4>
                        {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => {
                            const player = championRoster.find(p => String(p.포지션 || p.role).toUpperCase() === role);
                            return (
                                <div key={role} className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                    <div className="flex items-center gap-3">
                                        <RoleBadge role={role} />
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold">{player ? getKoreanName(player.이름) : 'TBD'}</span>
                                            <span className="text-gray-500 text-[10px] uppercase">{player?.이름 || 'Unknown'}</span>
                                        </div>
                                    </div>
                                    {player && <div className="text-yellow-500 text-xs">🏆</div>}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 최종 순위 표 (Right Column) */}
                <div className="lg:col-span-2 bg-white rounded-2xl border shadow-sm flex flex-col">
                    <div className="p-4 lg:p-6 border-b bg-gray-50 rounded-t-2xl">
                        <h3 className="text-lg lg:text-xl font-black text-gray-900 flex items-center gap-2">
                            📊 2026 {currentLeague} {LEAGUE_TITLES[currentLeague]} 최종 순위
                        </h3>
                    </div>
                    <div className="flex-1 p-4 lg:p-6 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 text-gray-500 font-bold border-b">
                                <tr>
                                    <th className="py-3 px-4 text-center w-16">순위</th>
                                    <th className="py-3 px-4 text-left">팀</th>
                                    <th className="py-3 px-4 text-right">상금 / 비고</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {finalStandings.map((item, idx) => {
                                    // Handle LCK vs LCP data structure differences
                                    const tObj = item.team || findGlobalTeam(item.id);
                                    const rank = item.rank || (idx + 1);
                                    const tColor = TEAM_COLORS[tObj.name] || tObj.colors?.primary || '#999';

                                    let prize = '-';
                                    if (rank === 1) prize = '0.5억 (🏆 우승)';
                                    else if (rank === 2) prize = '0.25억 (🥈 준우승)';
                                    else if (rank === 3) prize = '0.2억';
                                    else if (rank === 4) prize = '0.1억';

                                    return (
                                        <tr key={idx} className={`hover:bg-gray-50 transition ${rank === 1 ? 'bg-yellow-50/50' : ''}`}>
                                            <td className="py-3 px-4 text-center font-black text-gray-700">
                                                {rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : rank}
                                            </td>
                                            <td className="py-3 px-4 font-bold text-gray-800 flex items-center gap-3">
                                                <div className="w-6 h-6 rounded-full text-[8px] flex items-center justify-center text-white shadow-sm" 
                                                     style={{backgroundColor: tColor}}>
                                                    {tObj.name}
                                                </div>
                                                {tObj.fullName || tObj.name}
                                            </td>
                                            <td className="py-3 px-4 text-right font-bold text-gray-600">
                                                {prize}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-2 lg:p-6 max-w-7xl mx-auto space-y-6">
            
            {/* League Switcher */}
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 rounded-lg">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
                    <button
                        key={lg}
                        onClick={() => setCurrentLeague(lg)}
                        className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                            currentLeague === lg
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                        }`}
                    >
                        {lg}
                    </button>
                ))}
            </div>

            {renderLeagueHistory()}

        </div>
    );
};

export default HistoryTab;