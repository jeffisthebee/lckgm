import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teams } from './data/teams';

// Paste getLeagues, deleteLeague helpers here too or make a utils file.
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
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-8">
              <h1 className="text-4xl font-black text-gray-800 tracking-tight">LCK 매니저 2026</h1>
              <button onClick={handleClearData} className="text-xs text-red-500 underline hover:text-red-700">데이터 초기화 (오류 해결)</button>
          </div>
          <div className="grid gap-4">
            {leagues.map(l => {
              const t = teams.find(x => x.id === l.team.id);
              if (!t) return null;
              return (
                <div key={l.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition flex justify-between items-center group">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shadow-md text-lg" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                    <div><h2 className="text-xl font-bold group-hover:text-blue-600 transition">{t.fullName}</h2><p className="text-gray-500 font-medium text-sm">{l.leagueName} · {l.difficulty.toUpperCase()}</p></div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={()=>{updateLeague(l.id,{lastPlayed:new Date().toISOString()});navigate(`/league/${l.id}`)}} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">접속하기</button>
                    <button onClick={()=>{if(window.confirm('삭제하시겠습니까?')){deleteLeague(l.id);setLeagues(getLeagues())}}} className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition">삭제</button>
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => navigate('/new-league')} className="w-full mt-6 bg-white border-2 border-dashed border-gray-300 py-6 rounded-xl text-gray-400 hover:border-blue-500 hover:text-blue-500 font-bold text-xl transition flex items-center justify-center gap-2"><span>+</span> 새로운 시즌 시작하기</button>
        </div>
      </div>
    );
  }