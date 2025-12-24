import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
// 선수 데이터 임포트 (파일 경로: src/data/players.json)
import playerList from './data/players.json';

const teams = [
  { id: 1, name: 'GEN', fullName: '젠지 (Gen.G)', power: 94, description: '안정적인 운영과 강력한 라인전', colors: { primary: '#FFD700', secondary: '#000000' } },
  { id: 2, name: 'HLE', fullName: '한화생명 (HLE)', power: 93, description: '성장 가능성이 높은 팀', colors: { primary: '#FF6B00', secondary: '#FFFFFF' } },
  { id: 3, name: 'KT', fullName: '케이티 (KT)', power: 87, description: '공격적인 플레이 스타일', colors: { primary: '#FF4444', secondary: '#FFFFFF' } },
  { id: 4, name: 'T1', fullName: '티원 (T1)', power: 93, description: 'LCK의 최강팀, 세계 챔피언십 우승 경력', colors: { primary: '#E2012E', secondary: '#000000' } },
  { id: 5, name: 'DK', fullName: '디플러스 기아 (DK)', power: 84, description: '전략적 플레이와 팀워크', colors: { primary: '#00D9C4', secondary: '#FFFFFF' } },
  { id: 6, name: 'BNK', fullName: 'BNK 피어엑스 (BNK)', power: 82, description: '젊은 선수들의 잠재력', colors: { primary: '#FFB800', secondary: '#000000' } },
  { id: 7, name: 'NS', fullName: '농심 레드포스 (NS)', power: 85, description: '재건 중인 팀', colors: { primary: '#DC143C', secondary: '#FFFFFF' } },
  { id: 8, name: 'BRO', fullName: '브리온 (BRO)', power: 79, description: '기본기에 충실한 팀', colors: { primary: '#166534', secondary: '#FFFFFF' } },
  { id: 9, name: 'DRX', fullName: '디알엑스 (DRX)', power: 80, description: '변화를 추구하는 팀', colors: { primary: '#87CEEB', secondary: '#000000' } },
  { id: 10, name: 'DNS', fullName: 'DN 수퍼스 (DNS)', power: 82, description: '신생 팀, 도전 정신', colors: { primary: '#1E3A8A', secondary: '#FFFFFF' } },
];

const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];

// localStorage 관리 함수
const getLeagues = () => {
  const stored = localStorage.getItem('lckgm_leagues');
  return stored ? JSON.parse(stored) : [];
};

const saveLeagues = (leagues) => {
  localStorage.setItem('lckgm_leagues', JSON.stringify(leagues));
};

const addLeague = (league) => {
  const leagues = getLeagues();
  leagues.push(league);
  saveLeagues(leagues);
  return leagues;
};

const updateLeague = (id, updates) => {
  const leagues = getLeagues();
  const index = leagues.findIndex(l => l.id === id);
  if (index !== -1) {
    leagues[index] = { ...leagues[index], ...updates };
    saveLeagues(leagues);
  }
  return leagues;
};

const deleteLeague = (id) => {
  const leagues = getLeagues();
  const filtered = leagues.filter(l => l.id !== id);
  saveLeagues(filtered);
  return filtered;
};

const getLeagueById = (id) => {
  const leagues = getLeagues();
  return leagues.find(l => l.id === id);
};

// 색상 밝기 계산 함수
function getBrightness(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

function getTextColor(backgroundColor) {
  const brightness = getBrightness(backgroundColor);
  return brightness > 128 ? '#000000' : '#FFFFFF';
}

// 날짜 포맷 함수
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// 리그 목록 화면
function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();

  useEffect(() => {
    setLeagues(getLeagues());
  }, []);

  const handleDelete = (id) => {
    if (window.confirm('이 리그를 삭제하시겠습니까?')) {
      deleteLeague(id);
      setLeagues(getLeagues());
    }
  };

  const handleContinue = (league) => {
    updateLeague(league.id, { lastPlayed: new Date().toISOString() });
    navigate(`/league/${league.id}`);
  };

  const handleCreateNew = () => {
    navigate('/new-league');
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">내 리그 목록</h1>
          <p className="text-gray-600">저장된 리그를 선택하거나 새로운 리그를 생성하세요</p>
        </div>

        {leagues.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">저장된 리그</h2>
            <div className="space-y-3">
              {leagues.map((league) => {
                const team = teams.find(t => t.id === league.team.id);
                const difficulty = difficulties.find(d => d.value === league.difficulty);
                return (
                  <div key={league.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: team.colors.primary }}>
                            {team.name}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{league.leagueName}</h3>
                            <p className="text-sm text-gray-600">{team.fullName} · {difficulty.label}</p>
                          </div>
                        </div>
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>생성일: {formatDate(league.createdAt)}</span>
                          {league.lastPlayed && <span>마지막 플레이: {formatDate(league.lastPlayed)}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleContinue(league)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">계속하기</button>
                        <button onClick={() => handleDelete(league.id)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">삭제</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <button onClick={handleCreateNew} className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg">
            <span className="text-2xl">+</span> 새로운 리그 생성
          </button>
        </div>
      </div>
    </div>
  );
}

// 팀 선택 화면
function TeamSelection() {
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [selectedDifficulty, setSelectedDifficulty] = useState('normal');
  const [powerDisplay, setPowerDisplay] = useState(teams[0].power);
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();

  const currentTeam = teams[currentTeamIndex];

  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => {
      setPowerDisplay(currentTeam.power);
      setIsAnimating(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [currentTeam.power]);

  const handlePreviousTeam = () => setCurrentTeamIndex((prev) => (prev === 0 ? teams.length - 1 : prev - 1));
  const handleNextTeam = () => setCurrentTeamIndex((prev) => (prev === teams.length - 1 ? 0 : prev + 1));

  const handleStartGame = () => {
    const leagueName = `LCK Cup 2026 - ${currentTeam.fullName}`;
    const newLeague = {
      id: Date.now().toString(),
      leagueName,
      team: { id: currentTeam.id, name: currentTeam.name, fullName: currentTeam.fullName, colors: currentTeam.colors },
      difficulty: selectedDifficulty,
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
    };
    addLeague(newLeague);
    navigate(`/league/${newLeague.id}`);
  };

  const getPowerColor = (power) => {
    if (power >= 90) return 'text-red-600';
    if (power >= 80) return 'text-orange-600';
    if (power >= 70) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getDifficultyColor = (difficulty) => {
    const diff = difficulties.find(d => d.value === difficulty);
    const colors = {
      green: 'bg-green-100 text-green-800 border-green-300',
      blue: 'bg-blue-100 text-blue-800 border-blue-300',
      orange: 'bg-orange-100 text-orange-800 border-orange-300',
      red: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[diff?.color || 'blue'];
  };

  const teamColorStyle = { backgroundColor: currentTeam.colors.primary, color: getTextColor(currentTeam.colors.primary) };
  const teamBorderStyle = { borderColor: currentTeam.colors.primary };
  const accentBackgroundStyle = { backgroundColor: `${currentTeam.colors.primary}15`, transition: 'background-color 0.3s ease' };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 transition-all duration-300" style={accentBackgroundStyle}>
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">LCK 매니지먼트 게임</h1>
          <p className="text-gray-600">플레이할 팀을 선택하세요</p>
        </div>

        <div className="bg-white rounded-lg shadow-lg border-2 p-8 mb-6 transition-all duration-300" style={teamBorderStyle}>
          <div className="flex items-center justify-between mb-6">
            <button onClick={handlePreviousTeam} className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>

            <div className="flex-1 text-center px-8">
              <div className="mb-4">
                <div className="w-32 h-32 mx-auto mb-4 rounded-full flex items-center justify-center shadow-lg transition-all duration-300" style={teamColorStyle}>
                  <span className="text-4xl font-bold">{currentTeam.name}</span>
                </div>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{currentTeam.fullName}</h2>
              <p className="text-gray-600 mb-4">{currentTeam.description}</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                <span className="text-sm text-gray-600">전력:</span>
                <span className={`text-xl font-bold transition-all duration-200 ${isAnimating ? 'opacity-50 scale-110' : 'opacity-100 scale-100'} ${getPowerColor(powerDisplay)}`}>{powerDisplay}</span>
              </div>
            </div>

            <button onClick={handleNextTeam} className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors text-gray-700 hover:text-gray-900">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="flex justify-center gap-2">
            {teams.map((team, index) => (
              <button key={team.id} onClick={() => setCurrentTeamIndex(index)} className={`h-2 rounded-full transition-all ${index === currentTeamIndex ? 'w-8' : 'w-2 bg-gray-300 hover:bg-gray-400'}`} style={index === currentTeamIndex ? { backgroundColor: team.colors.primary } : {}} />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Difficulty</h3>
          <div className="grid grid-cols-4 gap-3">
            {difficulties.map((difficulty) => (
              <button key={difficulty.value} onClick={() => setSelectedDifficulty(difficulty.value)} className={`px-4 py-3 rounded-lg border-2 font-medium transition-all ${selectedDifficulty === difficulty.value ? getDifficultyColor(difficulty.value) + ' ring-2 ring-offset-2' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'}`}>
                {difficulty.label}
              </button>
            ))}
          </div>
          <div className={`mt-4 text-center transition-all duration-300 ${selectedDifficulty === 'insane' ? 'text-red-600' : 'text-gray-500'}`}>
            <p className="text-xs leading-relaxed">
              ⚠️ 난이도가 높을수록 FA 영입이 어려워지고, 경기 난이도와 선수들의 기복이 증가하며, 승리 확률이 감소합니다.
              {selectedDifficulty === 'insane' && <span className="block mt-1 font-semibold">운과 실력이 모두 필요한 최악의 난이도입니다.</span>}
            </p>
          </div>
        </div>

        <div className="text-center">
          <button onClick={handleStartGame} className="w-full max-w-md mx-auto px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105" style={{ backgroundColor: currentTeam.colors.primary, color: getTextColor(currentTeam.colors.primary) }}>
            시작하기
          </button>
        </div>
      </div>
    </div>
  );
}

// 대시보드 컴포넌트
function Dashboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);

  useEffect(() => {
    const foundLeague = getLeagueById(leagueId);
    if (foundLeague) {
      setLeague(foundLeague);
      updateLeague(leagueId, { lastPlayed: new Date().toISOString() });
    }
  }, [leagueId]);

  const team = league ? teams.find(t => t.id === league.team.id) : null;
  
  // --- 선수 데이터 필터링 로직 ---
  // players.json에서 내 팀 이름(예: 'GEN', 'T1')과 일치하는 선수만 가져옴
  const myRoster = team ? playerList.filter(p => p.팀 === team.name) : [];

  const handleNextGame = () => {
    alert('경기 시뮬레이션 기능은 곧 추가됩니다!');
  };

  const handleBack = () => {
    if (league) {
      updateLeague(league.id, { lastPlayed: new Date().toISOString() });
    }
    navigate('/');
  };

  if (!league || !team) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">리그를 찾을 수 없습니다.</p>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">리그 목록으로 돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex space-x-8">
              {['대시보드', '로스터', '일정', '순위', '통계'].map((item) => (
                <button key={item} className={`py-4 px-2 border-b-2 font-medium text-sm ${item === '대시보드' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>{item}</button>
              ))}
            </div>
            <button onClick={handleBack} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium flex items-center gap-2">
              <span>🏠</span> 리그 목록으로
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{league.leagueName}</h1>
            <p className="text-sm text-gray-600 mt-1">{team.fullName}</p>
          </div>
          <button onClick={handleNextGame} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">다음 경기 진행</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 순위표 */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">LCK CUP 순위</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-2 font-semibold text-gray-700">순위</th>
                    <th className="text-left py-2 px-2 font-semibold text-gray-700">팀</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-700">승</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-700">패</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-700">승률</th>
                    <th className="text-center py-2 px-2 font-semibold text-gray-700">득실차</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team, index) => (
                    <tr key={team.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-2 text-gray-900">{index + 1}</td>
                      <td className="py-2 px-2 text-gray-900 font-medium">{team.fullName}</td>
                      <td className="py-2 px-2 text-center text-gray-600">0</td>
                      <td className="py-2 px-2 text-center text-gray-600">0</td>
                      <td className="py-2 px-2 text-center text-gray-600">.000</td>
                      <td className="py-2 px-2 text-center text-gray-600">0</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 중앙 로스터 (수정된 부분) */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">현재 로스터</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 font-semibold text-gray-700">포지션</th>
                    <th className="py-2 font-semibold text-gray-700">이름</th>
                    <th className="py-2 font-semibold text-gray-700">종합</th>
                    <th className="py-2 font-semibold text-gray-700 text-right">특성</th>
                  </tr>
                </thead>
                <tbody>
                  {myRoster.length > 0 ? (
                    myRoster.map((player, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 font-bold text-gray-600">{player.포지션}</td>
                        <td className="py-3 font-semibold">{player.이름}</td>
                        <td className={`py-3 font-bold ${player.종합 >= 90 ? 'text-orange-600' : 'text-blue-600'}`}>
                          {player.종합}
                        </td>
                        <td className="py-3 text-xs text-gray-500 text-right">{player.특성}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-10 text-center text-gray-400">데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 우측 소식 */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">리그 소식</h2>
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 leading-relaxed">2026 LCK 컵 개막이 코앞으로 다가왔습니다!</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 leading-relaxed">새로운 로스터와 함께하는 2026 시즌, 우승컵의 주인공은?</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 메인 App 컴포넌트
function App() {
  return (
    <Routes>
      <Route path="/" element={<LeagueManager />} />
      <Route path="/new-league" element={<TeamSelection />} />
      <Route path="/league/:leagueId" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;