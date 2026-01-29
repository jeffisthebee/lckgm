// src/components/AwardsTab.jsx
import React, { useState, useMemo } from 'react';
import { computeAwards, computePlayoffAwards } from '../engine/statsManager';

// ... [RoleBadge Component - No Change] ...
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

// ... [PlayerCard Component - Updated for Playoff Bonuses] ...
const PlayerCard = ({ player, rank, playerList }) => {
    if (!player) return (
        <div className="min-w-[160px] h-[220px] bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            N/A
        </div>
    );
    
    const playerData = playerList.find(p => p.이름 === player.playerName);
    const koreanName = playerData ? playerData.실명 : player.playerName; 
    const ign = player.playerName;

    const rankStyles = {
        1: 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white ring-2 ring-yellow-200',
        2: 'border-gray-300 bg-gradient-to-br from-gray-50 to-white ring-1 ring-gray-200',
        3: 'border-orange-300 bg-gradient-to-br from-orange-50 to-white ring-1 ring-orange-200'
    };

    return (
        <div className={`relative min-w-[160px] w-[160px] lg:w-full p-3 rounded-xl border shadow-sm flex flex-col items-center gap-2 shrink-0 snap-center ${rankStyles[rank]}`}>
            <div className="absolute top-2 left-2 opacity-80 scale-90 origin-top-left">
                <RoleBadge role={player.role} />
            </div>

            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md mt-4" 
                 style={{ backgroundColor: player.teamObj?.colors?.primary || '#333' }}>
                {player.teamObj?.name || 'FA'}
            </div>

            <div className="text-center mb-1">
                <div className="font-black text-gray-900 text-base leading-tight">{koreanName}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{ign}</div>
            </div>

            <div className="w-full text-center mt-auto bg-white/50 rounded-lg p-2 border border-gray-100">
                <div className="text-2xl font-black text-gray-800 leading-none mb-1">{player.finalScore.toFixed(0)}</div>
                <div className="text-[10px] text-gray-400 font-bold mb-2">총 점수</div>
                
                <div className="text-[9px] text-gray-500 border-t border-gray-200 pt-1 mt-1">
                    <span className="font-bold">(세부 점수)</span>
                    <div className="flex justify-center flex-wrap gap-1 mt-0.5 whitespace-nowrap leading-tight">
                        <span title="팀 성적 점수">팀 {player.rankPoints}</span>
                        <span>+</span>
                        <span title="POG 포인트">POG {player.pogCount * 10}</span>
                        <span>+</span>
                        <span title="스탯 평점">지표 {player.avgScore.toFixed(0)}</span>
                        
                        {/* Regular MVP Bonus */}
                        {player.mvpBonus > 0 && (
                             <><span>+</span><span className="text-yellow-600 font-bold">MVP {player.mvpBonus}</span></>
                        )}

                        {/* Playoff Bonuses */}
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

// ... [TeamSection Component - No Change] ...
const TeamSection = ({ title, rank, players, playerList }) => {
    const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const headerStyles = {
        1: 'bg-yellow-500 text-white border-yellow-600',
        2: 'bg-gray-400 text-white border-gray-500',
        3: 'bg-orange-400 text-white border-orange-500'
    };
    return (
        <div className="mb-8 last:mb-0">
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`px-3 py-1 rounded-lg font-black text-sm shadow-sm border-b-2 ${headerStyles[rank]}`}>{title}</div>
                <div className="h-px bg-gray-200 flex-1"></div>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-4 px-1 -mx-1 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-5 lg:overflow-visible">
                {roles.map(role => ( <PlayerCard key={role} player={players[role]} rank={rank} playerList={playerList} /> ))}
            </div>
        </div>
    );
};

// MAIN COMPONENT
export default function AwardsTab({ league, teams, playerList }) {
    // 1. Check if Playoffs are finished
    const isPlayoffsFinished = useMemo(() => {
        const grandFinal = league.matches?.find(m => m.type === 'playoff' && m.round === 5);
        return grandFinal && grandFinal.status === 'finished';
    }, [league]);

    // 2. Tab State
    const [viewMode, setViewMode] = useState('regular'); // 'regular' | 'playoff'

    // 3. Compute Data based on Tab
    const regularData = useMemo(() => computeAwards(league, teams), [league, teams]);
    const playoffData = useMemo(() => isPlayoffsFinished ? computePlayoffAwards(league, teams) : null, [league, teams, isPlayoffsFinished]);

    const activeData = viewMode === 'playoff' ? playoffData : regularData;
    
    // Safety check
    if (!activeData) return <div className="p-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>;

    const { seasonMvp, finalsMvp, pogLeader, allProTeams } = activeData;
    
    // Determine which Main MVP to show
    const mainMvp = viewMode === 'playoff' ? finalsMvp : seasonMvp;
    
    // MVP Helper Data
    const mvpTeam = mainMvp ? teams.find(t => mainMvp.teams?.includes(t.name) || (mainMvp.teamObj && mainMvp.teamObj.id === t.id)) : null;
    const mvpPlayerData = mainMvp && playerList ? playerList.find(p => p.이름 === mainMvp.playerName) : null;
    const mvpRealName = mvpPlayerData ? mvpPlayerData.실명 : mainMvp?.playerName;

    return (
        <div className="p-2 lg:p-6 max-w-7xl mx-auto space-y-8">
            {/* Header & Toggle */}
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-center space-y-1">
                    <h2 className="text-3xl lg:text-4xl font-black text-gray-900 uppercase tracking-tighter">
                        <span className="text-blue-600">2026</span> LCK Awards
                    </h2>
                    <p className="text-gray-500 text-sm font-medium">
                        {viewMode === 'regular' ? 'Regular Season Performance' : 'Playoffs & Finals Performance'}
                    </p>
                </div>

                {isPlayoffsFinished && (
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                        <button 
                            onClick={() => setViewMode('regular')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'regular' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            정규 시즌
                        </button>
                        <button 
                            onClick={() => setViewMode('playoff')}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'playoff' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            플레이오프
                        </button>
                    </div>
                )}
            </div>

            {/* MVP Showcase Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start justify-center max-w-4xl mx-auto">
                
                {/* 1. Main MVP Card (Season MVP or Finals MVP) */}
                <div className="relative w-full bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6 lg:p-8 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-[150px] font-black leading-none pointer-events-none select-none">MVP</div>
                    
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className={`inline-block text-black font-black text-xs px-3 py-1 rounded-full mb-6 shadow-lg ${viewMode === 'playoff' ? 'bg-blue-400' : 'bg-yellow-500'}`}>
                            {viewMode === 'playoff' ? 'FINALS MVP' : 'SEASON MVP'}
                        </div>

                        {mainMvp ? (
                            <>
                                <div className={`w-28 h-28 bg-gray-700 rounded-full border-4 flex items-center justify-center text-3xl font-black shadow-2xl mb-4 relative ${viewMode === 'playoff' ? 'border-blue-400' : 'border-yellow-400'}`}
                                     style={{backgroundColor: mvpTeam?.colors?.primary}}>
                                    {mvpTeam?.name}
                                </div>
                                
                                <h1 className="text-4xl lg:text-5xl font-black text-white mb-1 tracking-tight">{mvpRealName}</h1>
                                <div className="text-xl text-gray-400 font-bold mb-6">{mainMvp.playerName}</div>
                                
                                <div className="w-full border-t border-gray-700 pt-4 mt-2">
                                     <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Total Score</div>
                                     <div className={`text-4xl font-black ${viewMode === 'playoff' ? 'text-blue-400' : 'text-yellow-400'}`}>
                                        {mainMvp.finalScore?.toFixed(0)}
                                     </div>
                                </div>
                            </>
                        ) : (
                            <div className="py-12 text-gray-500 font-bold">데이터 없음</div>
                        )}
                    </div>
                </div>

                {/* 2. Playoff POG Leader (Only visible in Playoff Mode) */}
                {viewMode === 'playoff' && pogLeader && (
                     <div className="relative w-full bg-white text-gray-800 p-6 lg:p-8 rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5 text-[100px] font-black leading-none pointer-events-none select-none">POG</div>
                        
                        <div className="relative z-10 flex flex-col items-center text-center">
                            <div className="inline-block bg-green-100 text-green-700 font-black text-xs px-3 py-1 rounded-full mb-6 border border-green-200">
                                PLAYOFFS POG KING
                            </div>

                            <div className="w-24 h-24 bg-gray-100 rounded-full border-4 border-green-500 flex items-center justify-center text-2xl font-black shadow-lg mb-4"
                                    style={{backgroundColor: pogLeader.teamObj?.colors?.primary}}>
                                {pogLeader.teamObj?.name}
                            </div>
                            
                            {(() => {
                                const pData = playerList.find(p => p.이름 === pogLeader.playerName);
                                return <h1 className="text-3xl font-black text-gray-900 mb-1">{pData ? pData.실명 : pogLeader.playerName}</h1>
                            })()}
                            
                            <div className="text-lg text-gray-500 font-bold mb-6">{pogLeader.playerName}</div>
                            
                            <div className="grid grid-cols-2 gap-4 w-full border-t border-gray-100 pt-4">
                                <div>
                                    <div className="text-3xl font-black text-green-600">{pogLeader.pogCount}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase">POG Count</div>
                                </div>
                                <div>
                                    <div className="text-3xl font-black text-gray-800">{pogLeader.finalScore?.toFixed(0)}</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase">Total Score</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* All-LCK / All-Playoff Teams */}
            <div>
                <TeamSection title={viewMode === 'playoff' ? "All-Playoff 1st Team" : "All-LCK 1st Team"} rank={1} players={allProTeams[1]} playerList={playerList} />
                <TeamSection title={viewMode === 'playoff' ? "All-Playoff 2nd Team" : "All-LCK 2nd Team"} rank={2} players={allProTeams[2]} playerList={playerList} />
                <TeamSection title={viewMode === 'playoff' ? "All-Playoff 3rd Team" : "All-LCK 3rd Team"} rank={3} players={allProTeams[3]} playerList={playerList} />
            </div>
        </div>
    );
}