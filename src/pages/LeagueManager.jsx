import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teams } from '../data/teams';

// Helper functions (same as before)
const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const deleteLeague = (id) => { const l = getLeagues().filter(x => x.id !== id); saveLeagues(l); return l; };
const updateLeague = (id, u) => { 
    const leagues = getLeagues(); 
    const index = leagues.findIndex(l => l.id === id); 
    if (index !== -1) { 
      leagues[index] = { ...leagues[index], ...u }; 
      saveLeagues(leagues); 
      return leagues[index];
    }
    return null;
  };

export default function LeagueManager() {
    const [leagues, setLeagues] = useState(getLeagues());
    const navigate = useNavigate();
    useEffect(() => setLeagues(getLeagues()), []);
     
    const handleClearData = () => {
      if(window.confirm('저장된 모든 데이터를 초기화하시겠습니까? 실행 후 접속 오류가 해결됩니다.')){
          localStorage.removeItem('lckgm_leagues');
          window.location.reload();
      }
    };
  
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 sm:mb-8">
              <h1 className="text-2xl sm:text-4xl font-black text-gray-800 tracking-tight">LCK 매니저 2026</h1>
              <button onClick={handleClearData} className="text-xs text-red-500 underline hover:text-red-700 whitespace-nowrap ml-2">데이터 초기화</button>
          </div>

          {/* League List */}
          <div className="grid gap-3 sm:gap-4">
            {leagues.map(l => {
              const t = teams.find(x => x.id === l.team.id);
              if (!t) return null;
              return (
                <div key={l.id} className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition flex flex-col sm:flex-row justify-between items-start sm:items-center group gap-4 sm:gap-0">
                  
                  {/* Team Info */}
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white shadow-md text-base sm:text-lg" style={{backgroundColor:t.colors.primary}}>
                      {t.name}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold group-hover:text-blue-600 transition truncate">{t.fullName}</h2>
                      <p className="text-gray-500 font-medium text-xs sm:text-sm truncate">{l.leagueName} · {l.difficulty.toUpperCase()}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                    <button 
                      onClick={()=>{updateLeague(l.id,{lastPlayed:new Date().toISOString()});navigate(`/league/${l.id}`)}} 
                      className="flex-1 sm:flex-none bg-blue-600 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition text-sm sm:text-base"
                    >
                      접속하기
                    </button>
                    <button 
                      onClick={()=>{if(window.confirm('삭제하시겠습니까?')){deleteLeague(l.id);setLeagues(getLeagues())}}} 
                      className="flex-1 sm:flex-none bg-gray-100 text-gray-600 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg font-bold hover:bg-gray-200 transition text-sm sm:text-base"
                    >
                      삭제
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          {/* New League Button */}
          <button 
            onClick={() => navigate('/new-league')} 
            className="w-full mt-4 sm:mt-6 bg-white border-2 border-dashed border-gray-300 py-4 sm:py-6 rounded-xl text-gray-400 hover:border-blue-500 hover:text-blue-500 font-bold text-lg sm:text-xl transition flex items-center justify-center gap-2"
          >
            <span>+</span> 새로운 시즌 시작하기
          </button>
        </div>
      </div>
    );
}