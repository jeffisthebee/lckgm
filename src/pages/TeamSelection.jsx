import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { teams } from '../data/teams';
import { difficulties, championList } from '../data/constants';

// Paste addLeague helper here
const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };

function getTextColor(hex) { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; }

export default function TeamSelection() {
    const [idx, setIdx] = useState(0);
    const [diff, setDiff] = useState('normal');
    const navigate = useNavigate();
    const current = teams[idx];
  
    const handleStart = () => {
      const newId = Date.now().toString();
      addLeague({
        id: newId,
        leagueName: `2026 LCK 컵 - ${current.name}`,
        team: current,
        difficulty: diff,
        createdAt: new Date().toISOString(),
        lastPlayed: new Date().toISOString(),
        groups: { baron: [], elder: [] },
        matches: [],
        standings: {},
        // 시즌 시작 시 초기 챔피언 리스트와 메타 버전 저장
        currentChampionList: championList,
        metaVersion: '16.01'
      });
      setTimeout(() => navigate(`/league/${newId}`), 50);
    };
  
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 transition-colors duration-500 p-4 sm:p-6" style={{backgroundColor:`${current.colors.primary}10`}}>
        <div 
          className="bg-white p-6 sm:p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-lg sm:max-w-5xl text-center border-t-8 transition-all duration-300" 
          style={{borderColor:current.colors.primary}}
        >
          <h2 className="text-2xl sm:text-3xl font-black mb-4 sm:mb-8 text-gray-900">팀 선택</h2>
          
          {/* Main Layout: Stack vertically on portrait, Side-by-side on Landscape(sm) and Desktop */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
            
            {/* Left Column: Team Display */}
            <div className="flex-1 w-full flex flex-col items-center">
              <div className="flex items-center justify-between w-full sm:w-auto sm:justify-center sm:gap-6 mb-4 sm:mb-6">
                <button 
                  onClick={()=>setIdx(i=>i===0?teams.length-1:i-1)} 
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition shadow-sm active:scale-95"
                >
                  ◀
                </button>
                
                <div className="flex flex-col items-center transform transition duration-300">
                  <div 
                    className="w-28 h-28 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-black text-white shadow-xl mb-3 sm:mb-6 ring-4 ring-white transition-all" 
                    style={{backgroundColor:current.colors.primary}}
                  >
                    {current.name}
                  </div>
                </div>

                <button 
                  onClick={()=>setIdx(i=>i===teams.length-1?0:i+1)} 
                  className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition shadow-sm active:scale-95"
                >
                  ▶
                </button>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">{current.fullName}</h3>
              <div className="inline-block bg-gray-100 px-4 py-1.5 rounded-full text-sm font-bold border border-gray-200">
                종합 전력: <span className="text-blue-600 text-lg">{current.power}</span>
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
                style={{backgroundColor:current.colors.primary, color:getTextColor(current.colors.primary)}}
              >
                2026 시즌 시작하기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
}