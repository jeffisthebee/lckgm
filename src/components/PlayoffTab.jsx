// src/components/PlayoffTab.jsx
import React, { useState } from 'react';
import MatchupBox from './MatchupBox'; 

const PlayoffTab = ({ 
    league, 
    teams, 
    hasPlayoffsGenerated, 
    handleMatchClick, 
    formatTeamName 
}) => {
    // [NEW] League Switcher Memory
    const [currentLeague, setCurrentLeague] = useState('LCK');
    
    // SAFETY CHECK 1: Basic Data
    if (!league || !teams) {
        return <div className="p-10 text-center text-gray-500">데이터 로딩 중...</div>;
    }

    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">
                {children}
            </div>
        </div>
    );

    const renderBracket = () => {
        const poMatches = league.matches ? league.matches.filter(m => m.type === 'playoff') : [];
        
        // --- SAFE HELPERS ---
        const getWinner = (m) => {
            if (!m || m.status !== 'finished' || !m.result || !m.result.winner) return null;
            const team = teams.find(t => t.name === m.result.winner);
            return team ? team.id : null;
        };

        const getLoser = (m) => {
            if (!m || m.status !== 'finished') return null;
            const winnerId = getWinner(m);
            return m.t1 === winnerId ? m.t2 : m.t1;
        };

        const getLowerSeedLoser = (m1, m2) => {
            const l1 = getLoser(m1);
            const l2 = getLoser(m2);
            if (!l1 || !l2) return null;
            const seed1 = league.playoffSeeds?.find(s => s.id === l1)?.seed || 99;
            const seed2 = league.playoffSeeds?.find(s => s.id === l2)?.seed || 99;
            return seed1 > seed2 ? l1 : l2;
        };

        const pendingMatch = (t1Id, t2Id) => ({
            status: 'pending',
            t1: t1Id || null,
            t2: t2Id || null
        });

        // Match Mapping
        const r1m1 = poMatches.find(m => m.round === 1 && m.match === 1);
        const r1m2 = poMatches.find(m => m.round === 1 && m.match === 2);
        
        const r2m1_actual = poMatches.find(m => m.round === 2 && m.match === 1);
        const r2m2_actual = poMatches.find(m => m.round === 2 && m.match === 2);
        const r2lm1_actual = poMatches.find(m => m.round === 2.1); 
        const r2lm2_actual = poMatches.find(m => m.round === 2.2);

        const r3m1_actual = poMatches.find(m => m.round === 3 && m.match === 1); 
        const r3lm1_actual = poMatches.find(m => m.round === 3.1); 
        
        const r4m1_actual = poMatches.find(m => m.round === 4);
        const r5m1_actual = poMatches.find(m => m.round === 5);

        return (
            <div className="w-full overflow-x-auto pb-8">
                <div className="min-w-[1200px] flex justify-between gap-8 relative">
                    {/* 1라운드 */}
                    <BracketColumn title="1라운드">
                        <MatchupBox match={r1m1} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                        <MatchupBox match={r1m2} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                    </BracketColumn>

                    {/* 2라운드 */}
                    <BracketColumn title="2라운드">
                        <MatchupBox match={r2m1_actual || pendingMatch(null, getWinner(r1m1))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                        <MatchupBox match={r2m2_actual || pendingMatch(null, getWinner(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                    </BracketColumn>

                    {/* 3라운드 (승자조) */}
                    <BracketColumn title="3라운드 (승자조)">
                        <MatchupBox match={r3m1_actual || pendingMatch(getWinner(r2m1_actual), getWinner(r2m2_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                    </BracketColumn>

                    {/* 결승전 */}
                    <BracketColumn title="결승전 (Grand Final)" className="ml-8 border-l-4 border-yellow-400 pl-8 rounded-l-3xl">
                        <MatchupBox match={r5m1_actual || pendingMatch(getWinner(r3m1_actual), getWinner(r4m1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                    </BracketColumn>
                    
                    {/* 패자조 플로팅 섹션 */}
                    <div className="absolute top-[320px] left-0 flex gap-8">
                        <BracketColumn title="패자조 2R 1경기">
                            <MatchupBox match={r2lm1_actual || pendingMatch(getLoser(r1m1), getLoser(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                        </BracketColumn>
                        <BracketColumn title="패자조 2R 2경기">
                            <MatchupBox match={r2lm2_actual || pendingMatch(null, getWinner(r2lm1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
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
        );
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[800px] flex flex-col">
            
            {/* [NEW] The League Switcher Buttons */}
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
            
            {currentLeague === 'LCK' ? (
                hasPlayoffsGenerated ? renderBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="text-4xl mb-4">🛡️</div>
                        <div className="text-xl font-bold">플레이오프가 아직 시작되지 않았습니다</div>
                        <p className="mt-2">정규 시즌과 플레이-인을 먼저 마무리해주세요.</p>
                    </div>
                )
            ) : (
                // [NEW] Placeholder for Foreign Leagues
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-4xl lg:text-6xl mb-3 lg:mb-4 animate-bounce">🌍</div>
                    <div className="text-xl lg:text-2xl font-black text-gray-600">{currentLeague} 플레이오프 준비 중</div>
                    <p className="mt-2 text-sm lg:text-base font-bold text-gray-500">해외 리그의 플레이오프 및 FST 토너먼트 로직은 다음 작전 단계에서 가동됩니다!</p>
                </div>
            )}
        </div>
    );
};

export default PlayoffTab;