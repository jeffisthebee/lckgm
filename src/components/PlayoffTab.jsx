// src/components/PlayoffTab.jsx
import React, { useState } from 'react';
import MatchupBox from './MatchupBox'; 
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

const PlayoffTab = ({ 
    league, 
    teams, 
    hasPlayoffsGenerated, 
    handleMatchClick, 
    formatTeamName 
}) => {
    // League Switcher Memory
    const [currentLeague, setCurrentLeague] = useState('LCK');
    
    // SAFETY CHECK: Basic Data
    if (!league || !teams) {
        return <div className="p-10 text-center text-gray-500">데이터 로딩 중...</div>;
    }

    const isLCK = currentLeague === 'LCK';
    const activeTeams = isLCK ? teams : (FOREIGN_LEAGUES[currentLeague] || []);
    
    // Determine visibility: LCP playoffs are visible if generated or if LCK is finished
    const isLCPGenerated = league.foreignMatches?.['LCP']?.some(m => m.type === 'playoff');
    const isLckFinished = !league.matches?.some(m => m.status === 'pending');

    // Helper to find team objects globally to prevent "TBD"
    const findActiveTeam = (teamId) => {
        if (!teamId) return { name: 'TBD' };
        // Check active league list first
        let found = activeTeams.find(t => t.id === teamId || t.name === teamId);
        if (found) return found;
        // Fallback to LCK teams
        found = teams.find(t => t.id === teamId || t.name === teamId);
        return found || { name: teamId };
    };

    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">
                {children}
            </div>
        </div>
    );

    // --- LCP BRACKET LOGIC ---
    const renderLCPBracket = () => {
        const lcpMatches = league.foreignMatches?.['LCP']?.filter(m => m.type === 'playoff') || [];
        const seeds = league.foreignPlayoffSeeds?.['LCP'] || [];

        const getWinnerId = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const team = activeTeams.find(t => t.name === m.result.winner);
            return team ? team.id || team.name : m.result.winner;
        };

        const getLoserId = (m) => {
            if (!m || m.status !== 'finished') return null;
            const winnerId = getWinnerId(m);
            return m.t1 === winnerId ? m.t2 : m.t1;
        };

        const findM = (round, matchNum) => lcpMatches.find(m => m.round === round && m.match === matchNum);
        const pendingM = (t1, t2) => ({ t1: t1 || null, t2: t2 || null, status: 'pending', type: 'playoff' });

        // Match lookups based on LCP schedule logic
        const r1m1 = findM(1, 1); // S3 vs S5/6
        const r1m2 = findM(1, 2); // S4 vs S5/6
        const r2m1 = findM(2, 1); // S1 vs Winner R1
        const r2m2 = findM(2, 2); // S2 vs Winner R1
        const r3m1 = findM(3, 1); // Upper Final
        const r2lm1 = findM(2.1, 1); // Lower R1 (Losers of R2)
        const r3lm1 = findM(3.1, 1); // Lower Final (Winner R2.1 vs Loser R3)
        const final = findM(4, 1);   // Grand Final

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1200px] relative pt-12">
                    {/* Upper Bracket */}
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Upper Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="PO 1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r1m1} onClick={handleMatchClick} formatTeamName={(id) => findActiveTeam(id).name} />
                                    <MatchupBox match={r1m2} onClick={handleMatchClick} formatTeamName={(id) => findActiveTeam(id).name} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="PO 2라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r2m1 || pendingM(null, getWinnerId(r1m1))} onClick={handleMatchClick} formatTeamName={(id) => findActiveTeam(id).name} />
                                    <MatchupBox match={r2m2 || pendingM(null, getWinnerId(r1m2))} onClick={handleMatchClick} formatTeamName={(id) => findActiveTeam(id).name} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={r3m1 || pendingM(getWinnerId(r2m1), getWinnerId(r2m2))} onClick={handleMatchClick} formatTeamName={(id) => findActiveTeam(id).name} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={final || pendingM(getWinnerId(r3m1), null)} onClick={handleMatchClick} formatTeamName={(id) => findActiveTeam(id).name} />
                            </BracketColumn>
                        </div>
                    </div>

                    {/* Lower Bracket */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={r2lm1 || pendingM(getLoserId(r2m1), getLoserId(r2m2))} onClick={handleMatchClick} formatTeamName={(id) => findActiveTeam(id).name} />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={r3lm1 || pendingM(getWinnerId(r2lm1), getLoserId(r3m1))} onClick={handleMatchClick} formatTeamName={(id) => findActiveTeam(id).name} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // --- LCK BRACKET LOGIC (Preserved) ---
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
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Winner's Bracket)</h3>
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
                            <BracketColumn title="결승전">
                                <MatchupBox match={final_actual || pendingMatch(getWinner(r3m1_actual), getWinner(r4m1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                        </div>
                    </div>

                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Loser's Bracket)</h3>
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

    return (
        <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[800px] flex flex-col">
            
            {/* League Switcher */}
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50 rounded-lg mb-4 sm:mb-6">
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

            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                👑 2026 {currentLeague} 플레이오프
            </h2>
            
            {/* Traffic Director */}
            {isLCK ? (
                hasPlayoffsGenerated ? renderLCKBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="text-4xl mb-4">🛡️</div>
                        <div className="text-xl font-bold">플레이오프가 아직 시작되지 않았습니다</div>
                        <p className="mt-2">정규 시즌과 플레이-인을 먼저 마무리해주세요.</p>
                    </div>
                )
            ) : currentLeague === 'LCP' ? (
                (isLCPGenerated || isLckFinished) ? renderLCPBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="text-4xl mb-4">🛡️</div>
                        <div className="text-xl font-bold">LCP 플레이오프 대진표 준비 중</div>
                        <p className="mt-2">LCP 정규 시즌이 진행 중이거나 LCK 일정을 더 진행해야 합니다.</p>
                    </div>
                )
            ) : (
                // Placeholder for other leagues
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-4xl lg:text-6xl mb-3 lg:mb-4 animate-bounce">🌍</div>
                    <div className="text-xl lg:text-2xl font-black text-gray-600">{currentLeague} 플레이오프 준비 중</div>
                    <p className="mt-2 text-sm lg:text-base font-bold text-gray-500">해외 리그의 플레이오프 로직은 다음 단계에서 가동됩니다!</p>
                </div>
            )}
        </div>
    );
};

export default PlayoffTab;