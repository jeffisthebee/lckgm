import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teams } from '../data/teams';
import TutorialModal from '../components/TutorialModal'; 

// Helper functions
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
    const [showTutorial, setShowTutorial] = useState(false);
    const navigate = useNavigate();
    
    useEffect(() => {
        setLeagues(getLeagues());
        
        // CHECK: Has the user explicitly turned it off?
        // If "lckgm_tutorial_hidden" is NOT present, we show it (Default: Always Popup)
        const isHidden = localStorage.getItem('lckgm_tutorial_hidden');
        if (!isHidden) {
            setShowTutorial(true);
        }
    }, []);
     
    // 1. Simply close for this session (will pop up again on refresh)
    const handleCloseTutorial = () => {
        setShowTutorial(false);
    };

    // 2. Turn off permanently (or until data reset)
    const handleDoNotShowAgain = () => {
        if(window.confirm('다음부터 이 창을 띄우지 않겠습니까? (상단 ? 버튼으로 다시 볼 수 있습니다)')) {
            localStorage.setItem('lckgm_tutorial_hidden', 'true');
            setShowTutorial(false);
        }
    };

    // Manually open help
    const handleOpenTutorial = () => {
        setShowTutorial(true);
    };

    const handleClearData = () => {
      if(window.confirm('저장된 모든 데이터를 초기화하시겠습니까? 실행 후 접속 오류가 해결됩니다.')){
          localStorage.removeItem('lckgm_leagues');
          localStorage.removeItem('lckgm_tutorial_hidden'); // Reset the tutorial flag too
          window.location.reload();
      }
    };
  
    return (
      <div className="min-h-screen bg-gray-100 p-4 sm:p-8 relative">
        
        {/* Pass both handlers to the modal */}
        {showTutorial && (
            <TutorialModal 
                onClose={handleCloseTutorial} 
                onDoNotShowAgain={handleDoNotShowAgain} 
            />
        )}

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-4 sm:mb-8">
              <div className="flex items-center gap-3">
                  <h1 className="text-2xl sm:text-4xl font-black text-gray-800 tracking-tight">LCK 매니저 2026</h1>
                  <button 
                    onClick={handleOpenTutorial} 
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-200 text-gray-600 font-bold flex items-center justify-center hover:bg-gray-300 transition text-xs sm:text-sm"
                    title="가이드 보기"
                  >
                    ?
                  </button>
              </div>
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