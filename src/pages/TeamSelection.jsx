import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teams } from '../data/teams';
import { difficulties, championList, TEAM_COLORS } from '../data/constants';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';
import { saveLeague } from '../engine/storage';
function getTextColor(hex) { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; }

// Safely resolve colors for any team — LCK teams have colors object, foreign teams use TEAM_COLORS from constants
const getTeamColors = (team) => {
  if (team?.colors?.primary) return team.colors;
  const primary = (TEAM_COLORS && TEAM_COLORS[team?.name]) || '#607d8b';
  return { primary, secondary: '#ffffff' };
};

const LEAGUE_SEASON_NAMES = {
    LCK:   '2026 LCK 컵',
    LPL:   '2026 LPL 스플릿 1',
    LEC:   '2026 LEC 버서스',
    LCS:   '2026 LCS 락 인',
    LCP:   '2026 LCP 스플릿 1',
    CBLOL: '2026 CBLOL 레전드 컵',
};

const ALL_LEAGUES = {
    LCK: teams,
    ...FOREIGN_LEAGUES,
};

export default function TeamSelection() {
    const [selectedLeague, setSelectedLeague] = useState('LCK');
    const [idx, setIdx] = useState(0);
    const [diff, setDiff] = useState('normal');
    const navigate = useNavigate();

    const currentTeamList = ALL_LEAGUES[selectedLeague] || teams;
    const current = currentTeamList[idx] || currentTeamList[0];

    const handleLeagueSwitch = (lg) => {
        setSelectedLeague(lg);
        setIdx(0);
    };

    const handleStart = async () => {
      const newId = Date.now().toString();
      const seasonName = LEAGUE_SEASON_NAMES[selectedLeague] || `2026 ${selectedLeague}`;
      // Ensure colors always exist (foreign teams don't have them in JSON)
      const teamWithColors = { ...current, colors: getTeamColors(current) };
      const newLeague = {
        id: newId,
        leagueName: `${seasonName} - ${teamWithColors.name}`,
        leagueType: selectedLeague,
        team: teamWithColors,
        difficulty: diff,
        createdAt: new Date().toISOString(),
        lastPlayed: new Date().toISOString(),
        
        // -- LCK DATA --
        groups: { baron: [], elder: [] },
        matches: [],
        standings: {},
        currentChampionList: championList,
        metaVersion: '16.01',

        // -- [NEW GLOBAL DATA] --
        foreignLeagues: FOREIGN_LEAGUES, 
        
        foreignStandings: {
            LPL: {}, LEC: {}, LCS: {}, LCP: {}, CBLOL: {}
        },
        
        foreignMatches: {
            LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: []
        },

        foreignHistory: {
          LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: []
        }
      };
      await saveLeague(newLeague);
      navigate(`/league/${newId}`);
    };
  
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 transition-colors duration-500 p-4 sm:p-6" style={{backgroundColor:`${getTeamColors(current).primary}10`}}>
        <div 
          className="bg-white p-6 sm:p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-lg sm:max-w-5xl text-center border-t-8 transition-all duration-300" 
          style={{borderColor:getTeamColors(current).primary}}
        >
          <h2 className="text-2xl sm:text-3xl font-black mb-4 text-gray-900">팀 선택</h2>

          {/* League Selector */}
          <div className="flex gap-2 justify-center flex-wrap mb-6">
            {Object.keys(ALL_LEAGUES).map(lg => (
              <button
                key={lg}
                onClick={() => handleLeagueSwitch(lg)}
                className={`px-4 py-1.5 rounded-full font-bold text-xs sm:text-sm transition shadow-sm active:scale-95 border-2 ${
                  selectedLeague === lg
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {lg}
              </button>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
            
            {/* Left Column: Team Display */}
            <div className="flex-1 w-full flex flex-col items-center">
              <div className="flex items-center justify-between w-full sm:w-auto sm:justify-center sm:gap-6 mb-4 sm:mb-6">
                <button 
                  onClick={()=>setIdx(i=>i===0?currentTeamList.length-1:i-1)} 
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition shadow-sm active:scale-95"
                >
                  ◀
                </button>
                
                <div className="flex flex-col items-center transform transition duration-300">
                  <div 
                    className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-black text-white shadow-xl mb-3 sm:mb-6 ring-4 ring-white transition-all" 
                    style={{backgroundColor:getTeamColors(current).primary}}
                  >
                    {current.name}
                  </div>
                </div>

                <button 
                  onClick={()=>setIdx(i=>i===currentTeamList.length-1?0:i+1)} 
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition shadow-sm active:scale-95"
                >
                  ▶
                </button>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">{current.fullName}</h3>
              <div className="flex items-center gap-3 justify-center">
                <div className="inline-block bg-gray-100 px-4 py-1.5 rounded-full text-sm font-bold border border-gray-200">
                  종합 전력: <span className="text-blue-600 text-lg">{current.power}</span>
                </div>
                <div className="inline-block bg-blue-50 px-3 py-1.5 rounded-full text-xs font-bold border border-blue-100 text-blue-600">
                  {selectedLeague}
                </div>
              </div>
            </div>

            {/* Divider for mobile portrait only */}
            <div className="w-full h-px bg-gray-200 sm:hidden"></div>

            {/* Right Column: Settings & Start */}
            <div className="flex-1 w-full flex flex-col justify-center">
              <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-4">
                {difficulties.map(d=>(
                  <button 
                    key={d.value} 
                    onClick={()=>setDiff(d.value)} 
                    className={`py-2 sm:py-3 rounded-xl border-2 font-bold text-xs sm:text-sm transition ${diff===d.value?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              
              <div className="bg-gray-50 rounded-lg p-3 sm:p-4 mb-4 sm:mb-8 text-xs sm:text-sm leading-relaxed border border-gray-100 text-left">
                <p className="text-gray-600 font-medium">ℹ️ 난이도가 상승할수록 승리 확률 감소, 재계약 확률 감소, 선수의 기복이 증가합니다.</p>
                {diff === 'insane' && <p className="text-red-600 font-bold mt-2 animate-pulse">⚠️ 극악 난이도는 운과 실력이 모두 필요한 최악의 시나리오입니다.</p>}
              </div>
              
              <button 
                onClick={handleStart} 
                className="w-full py-4 sm:py-5 rounded-2xl font-black text-lg sm:text-xl text-white shadow-lg hover:shadow-xl hover:opacity-90 transition transform hover:-translate-y-1 active:translate-y-0" 
                style={{backgroundColor:getTeamColors(current).primary, color:getTextColor(getTeamColors(current).primary)}}
              >
                2026 시즌 시작하기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
}