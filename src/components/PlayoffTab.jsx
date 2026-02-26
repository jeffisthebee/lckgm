// src/components/PlayoffTab.jsx
import React, { useState } from 'react';
import MatchupBox from './MatchupBox'; 

// Import global data to prevent TBD names
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';
import { TEAM_COLORS } from '../data/constants';

const PlayoffTab = ({ 
    league, 
    teams, 
    hasPlayoffsGenerated, 
    handleMatchClick, 
    formatTeamName 
}) => {
    // Memory box for switching leagues
    const [currentLeague, setCurrentLeague] = useState('LCK');
    
    if (!league || !teams) {
        return <div className="p-10 text-center text-gray-500">데이터 로딩 중...</div>;
    }

    // --- GLOBAL TEAM RESOLVER ---
    // Hunts for the team object anywhere in the world to get names and colors
    const resolveTeam = (idOrName) => {
        if (!idOrName) return { name: 'TBD', colors: { primary: '#999' } };
        
        // 1. Search LCK
        let found = teams.find(t => String(t.id) === String(idOrName) || t.name === idOrName);
        if (found) return found;

        // 2. Search Foreign Leagues
        for (const lg in FOREIGN_LEAGUES) {
            found = FOREIGN_LEAGUES[lg].find(t => String(t.id) === String(idOrName) || t.name === idOrName);
            if (found) {
                // Attach constant colors if missing in JSON
                return { ...found, colors: { primary: TEAM_COLORS[found.name] || '#333' } };
            }
        }
        return { name: idOrName, colors: { primary: '#333' } };
    };

    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-[10px] lg:text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 border-b pb-1 w-full text-center">{title}</h4>
            <div className="w-full flex flex-col items-center">
                {children}
            </div>
        </div>
    );

    // --- LCP BRACKET LOGIC (Hybrid Double-Elim) ---
    const renderLCPBracket = () => {
        const lcpMatches = league.foreignMatches?.['LCP'] || [];
        const lcpSeeds = league.foreignPlayoffSeeds?.['LCP'] || [];

        const findMatch = (round, matchNum) => lcpMatches.find(m => m.round === round && m.match === matchNum);
        const getWinnerId = (m) => (m?.status === 'finished' && m.result?.winner) ? m.result.winner : null;
        const getLoserId = (m) => {
            if (!m || m.status !== 'finished') return null;
            const win = m.result.winner;
            return (win === resolveTeam(m.t1).name) ? m.t2 : m.t1;
        };

        const pendingMatch = (t1, t2) => ({ t1: t1 || null, t2: t2 || null, status: 'pending', type: 'playoff' });

        // Match Mapping
        const r1m1 = findMatch(1, 1);
        const r1m2 = findMatch(1, 2);
        const r2m1 = findMatch(2, 1);
        const r2m2 = findMatch(2, 2);
        const r3m1 = findMatch(3, 1); // WB Final
        const r2lm1 = findMatch(2.1, 1); // LB R2
        const r3lm1 = findMatch(3.1, 1); // LB Final
        const final = findMatch(4, 1);

        return (
            <div className="flex-1 overflow-x-auto pb-12">
                <div className="flex flex-col space-y-20 min-w-[1200px] relative pt-8">
                    {/* Top Path: Winners */}
                    <div className="relative border-b-2 border-dashed border-gray-100 pb-16">
                         <div className="flex justify-between items-start">
                            <BracketColumn title="1라운드 (2/12-13)">
                                <div className="flex flex-col justify-around h-[300px] space-y-8">
                                    <MatchupBox match={r1m1} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={r1m2} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="2라운드 (2/14-15)">
                                <div className="flex flex-col justify-around h-[300px] space-y-8">
                                    <MatchupBox match={r2m1 || pendingMatch(null, getWinnerId(r1m1))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={r2m2 || pendingMatch(null, getWinnerId(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="승자조 결승 (2/26)">
                                <div className="flex flex-col justify-center h-[300px]">
                                    <MatchupBox match={r3m1 || pendingMatch(getWinnerId(r2m1), getWinnerId(r2m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>

                            <BracketColumn title="결승전 (3/1)" className="border-l-4 border-yellow-400 pl-8 rounded-l-3xl bg-yellow-50/30">
                                <div className="flex flex-col justify-center h-[300px]">
                                    <MatchupBox match={final || pendingMatch(getWinnerId(r3m1), getWinnerId(r3lm1))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                         </div>
                    </div>

                    {/* Bottom Path: Loser's bracket starts from R2 Losers */}
                    <div className="relative pt-4">
                        <h3 className="text-sm font-black text-red-500 mb-6 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span> 패자조 (Loser's Bracket)
                        </h3>
                        <div className="flex justify-start items-center space-x-12 ml-52">
                            <BracketColumn title="패자조 2R (2/27)">
                                <MatchupBox match={r2lm1 || pendingMatch(getLoserId(r2m1), getLoserId(r2m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전 (2/28)">
                                <MatchupBox match={r3lm1 || pendingMatch(getWinnerId(r2lm1), getLoserId(r3m1))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- LCK BRACKET LOGIC (Double-Elim) ---
    const renderLCKBracket = () => {
        const poMatches = league.matches ? league.matches.filter(m => m.type === 'playoff') : [];
        
        const getWinner = (m) => {
            if (!m || m.status !== 'finished' || !m.result || !m.result.winner) return null;
            const team = teams.find(t => t.name === m.result.winner);
            return team ? team.id : null;
        };

        const getLoser = (m) => {
            if (!m || m.status !== 'finished' || !m.result || !m.result.winner) return null;
            const winnerId = getWinner(m);
            if (!winnerId) return null;
            return m.t1 === winnerId ? m.t2 : m.t1;
        };

        const findMatch = (round, matchNum) => poMatches.find(m => m.round === round && m.match === matchNum);

        const r1m1 = findMatch(1, 1);
        const r1m2 = findMatch(1, 2);
        const r2m1_actual = findMatch(2, 1);
        const r2m2_actual = findMatch(2, 2);
        const r2lm1_actual = findMatch(2.1, 1);
        const r2lm2_actual = findMatch(2.2, 1);
        const r3m1_actual = findMatch(3, 1);
        const r3lm1_actual = findMatch(3.1, 1);
        const r4m1_actual = findMatch(4, 1);
        const final_actual = findMatch(5, 1);

        const getSeedId = (seedNum) => {
            if (!league.playoffSeeds) return null;
            const s = league.playoffSeeds.find(item => item.seed === seedNum);
            return s ? s.id : null;
        };

        const pendingMatch = (t1, t2) => ({ t1: t1 || null, t2: t2 || null, status: 'pending', type: 'playoff' });

        const getHigherSeedLoser = (matchA, matchB) => {
            const loserA = getLoser(matchA);
            const loserB = getLoser(matchB);
            if (!loserA) return loserB;
            if (!loserB) return loserA;
            const seedA = league.playoffSeeds?.find(s => s.id === loserA)?.seed || 99;
            const seedB = league.playoffSeeds?.find(s => s.id === loserB)?.seed || 99;
            return seedA < seedB ? loserA : loserB;
        };

        const getLowerSeedLoser = (matchA, matchB) => {
            const higher = getHigherSeedLoser(matchA, matchB);
            const loserA = getLoser(matchA);
            return (loserA === higher) ? getLoser(matchB) : loserA;
        };

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1400px] relative pt-12">
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2 tracking-tighter">승자조 (Winner's Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r1m1} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={r1m2} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2R">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r2m1_actual || pendingMatch(getSeedId(1), getWinner(r1m1))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={r2m2_actual || pendingMatch(getSeedId(2), getWinner(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={r3m1_actual || pendingMatch(getWinner(r2m1_actual), getWinner(r2m2_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="결승전" className="ml-8 border-l-4 border-yellow-400 pl-8 rounded-l-3xl">
                                <MatchupBox match={final_actual || pendingMatch(getWinner(r3m1_actual), getWinner(r4m1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                        </div>
                    </div>

                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2 tracking-tighter">패자조 (Loser's Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={r2lm1_actual || pendingMatch(getLoser(r1m1), getLoser(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 2R">
                                <MatchupBox match={r2lm2_actual || pendingMatch(getHigherSeedLoser(r2m1_actual, r2m2_actual), getWinner(r2lm1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 3R">
                                <MatchupBox match={r3lm1_actual || pendingMatch(getLowerSeedLoser(r2m1_actual, r2m2_actual), getWinner(r2lm2_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={r4m1_actual || pendingMatch(getLoser(r3m1_actual), getWinner(r3lm1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const isLCPReady = currentLeague === 'LCP' && league.foreignPlayoffSeeds?.['LCP']?.length > 0;

    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 lg:p-8 min-h-[800px] flex flex-col h-full lg:h-auto overflow-y-auto">
            
            {/* LEAGUE SELECTOR */}
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50 rounded-lg mb-6">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
                    <button
                        key={lg}
                        onClick={() => setCurrentLeague(lg)}
                        className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                            currentLeague === lg
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105'
                            : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                        }`}
                    >
                        {lg}
                    </button>
                ))}
            </div>

            <h2 className="text-xl lg:text-3xl font-black text-gray-900 mb-8 flex items-center gap-3">
                👑 2026 {currentLeague} 플레이오프
            </h2>
            
            {currentLeague === 'LCK' ? (
                hasPlayoffsGenerated ? renderLCKBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20">
                        <div className="text-6xl mb-6">🛡️</div>
                        <div className="text-2xl font-bold">플레이오프 대진표 준비 중</div>
                        <p className="mt-2 text-gray-500 font-medium">정규 시즌과 플레이-인을 모두 마친 후 대진이 생성됩니다.</p>
                    </div>
                )
            ) : currentLeague === 'LCP' ? (
                isLCPReady ? renderLCPBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20">
                        <div className="text-6xl mb-6 animate-pulse">⏳</div>
                        <div className="text-2xl font-bold">LCP 플레이오프 대기 중</div>
                        <p className="mt-2 text-gray-500 font-medium">LCP 정규 시즌이 종료되면 자동으로 대진표가 활성화됩니다.</p>
                    </div>
                )
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-4xl lg:text-6xl mb-4 animate-bounce">🌍</div>
                    <div className="text-xl lg:text-2xl font-black text-gray-600">{currentLeague} 플레이오프 준비 중</div>
                    <p className="mt-2 text-sm lg:text-base font-bold text-gray-500">해외 리그 토너먼트 로직은 다음 작전 단계에서 순차적으로 가동됩니다!</p>
                </div>
            )}
        </div>
    );
};

export default PlayoffTab;