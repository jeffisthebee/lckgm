// src/components/FSTTournamentTab.jsx
import React, { useState } from 'react';

// ─── League config ────────────────────────────────────────────
const LEAGUE_CONFIG = {
  LCK:   { label: 'LCK', flag: '🇰🇷', color: '#0051FF', bg: 'from-blue-900 to-blue-950' },
  LPL:   { label: 'LPL', flag: '🇨🇳', color: '#E8001C', bg: 'from-red-900 to-red-950' },
  LEC:   { label: 'LEC', flag: '🇪🇺', color: '#00B4D8', bg: 'from-cyan-900 to-cyan-950' },
  LCS:   { label: 'LCS', flag: '🇺🇸', color: '#7C3AED', bg: 'from-violet-900 to-violet-950' },
  LCP:   { label: 'LCP', flag: '🌏', color: '#059669', bg: 'from-emerald-900 to-emerald-950' },
  CBLOL: { label: 'CBLOL', flag: '🇧🇷', color: '#F59E0B', bg: 'from-yellow-900 to-yellow-950' },
};

const SLOT_LABEL = { C: '챔피언', RU: '준우승' };

// ─── Helpers ──────────────────────────────────────────────────
const getTeam = (fstId, teams) => teams?.find(t => t.fstId === fstId);

const getTeamDisplayName = (fstId, teams) => {
  if (!fstId) return 'TBD';
  const t = getTeam(fstId, teams);
  return t ? t.name : fstId;
};

const getTeamColor = (fstId, teams) => {
  const t = getTeam(fstId, teams);
  return t?.colors?.primary || '#6B7280';
};

const getLeagueCfg = (fstId) => {
  const league = fstId?.split('_')[0];
  return LEAGUE_CONFIG[league] || { label: league || '?', flag: '🌐', color: '#6B7280' };
};

const getMatchResult = (match) => {
  if (!match || match.status !== 'finished') return null;
  return match.result || null;
};

const findMatch = (matches, fstRound) => matches?.find(m => m.fstRound === fstRound);

const getWinner = (match) => {
  if (!match?.result?.winner) return null;
  return match.result.winner; // this is a team name string
};

// Returns fstId of winner from a finished match
const getWinnerFstId = (match, teams) => {
  if (!match?.result?.winner) return null;
  const winnerName = match.result.winner;
  const t = teams?.find(t => t.name === winnerName);
  return t?.fstId || null;
};

const getLoserFstId = (match, teams) => {
  if (!match?.result?.winner) return null;
  const winnerId = getWinnerFstId(match, teams);
  return match.t1 === winnerId ? match.t2 : match.t1;
};

// ─── Team Badge ───────────────────────────────────────────────
const TeamBadge = ({ fstId, teams, isWinner = false, isEliminated = false, size = 'md' }) => {
  const team = getTeam(fstId, teams);
  const cfg  = getLeagueCfg(fstId);
  const name = team?.name || (fstId ? fstId.split('_')[0] : 'TBD');
  const color = team?.colors?.primary || cfg.color;

  const sizes = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2 font-black',
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full font-bold transition-all ${sizes[size]}
      ${isWinner ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900' : ''}
      ${isEliminated ? 'opacity-30 line-through' : ''}
    `}
      style={{ backgroundColor: color + '22', border: `1.5px solid ${color}66`, color: color }}
    >
      <span className="text-xs">{cfg.flag}</span>
      <span>{name}</span>
      {team?.slot === 'RU' && <span className="text-[9px] opacity-60 font-normal">2위</span>}
    </div>
  );
};

// ─── FST Match Card ───────────────────────────────────────────
const FSTMatchCard = ({ match, teams, onSimulate, onMatchClick, pending = false, myTeamName, isNextMatch }) => {
  if (!match) {
    return (
      <div className="w-44 h-20 rounded-xl border-2 border-dashed border-gray-700 flex items-center justify-center text-gray-600 text-xs font-bold">
        TBD
      </div>
    );
  }

  const result   = getMatchResult(match);
  const isDone   = match.status === 'finished';
  const t1Name   = getTeamDisplayName(match.t1, teams);
  const t2Name   = getTeamDisplayName(match.t2, teams);
  const t1Color  = getTeamColor(match.t1, teams);
  const t2Color  = getTeamColor(match.t2, teams);
  const t1Win    = isDone && result?.winner === t1Name;
  const t2Win    = isDone && result?.winner === t2Name;

  // Parse score
  let s1 = '', s2 = '';
  if (isDone && result?.score) {
    const parts = String(result.score).split(/[-:]/);
    if (parts.length === 2) {
      const [a, b] = [parseInt(parts[0]), parseInt(parts[1])];
      s1 = t1Win ? Math.max(a, b) : Math.min(a, b);
      s2 = t2Win ? Math.max(a, b) : Math.min(a, b);
    }
  }

  return (
    <div
      className={`w-48 rounded-xl overflow-hidden shadow-lg border transition-all
        ${isDone ? 'border-gray-600 cursor-pointer hover:border-yellow-500 hover:shadow-yellow-500/20 hover:shadow-xl' : 'border-gray-700'}
        ${pending ? 'opacity-40' : ''}
        bg-gray-900
      `}
      onClick={() => isDone && onMatchClick && onMatchClick(match)}
    >
      {/* Label bar */}
      <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest px-3 pt-2 pb-1 flex justify-between items-center">
        <span>{match.label || match.fstRound}</span>
        {match.fearless && <span className="text-orange-500">FEARLESS</span>}
      </div>

      {/* Team 1 */}
      <div className={`flex items-center justify-between px-3 py-2 ${t1Win ? 'bg-gray-800' : ''}`}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t1Color }} />
          <span className={`text-sm font-bold ${!match.t1 ? 'text-gray-600' : t1Win ? 'text-white' : 'text-gray-300'} ${!t1Win && isDone ? 'opacity-50' : ''}`}>
            {match.t1 ? t1Name : 'TBD'}
          </span>
        </div>
        <span className={`text-sm font-black ${t1Win ? 'text-yellow-400' : 'text-gray-600'}`}>{s1}</span>
      </div>

      <div className="h-px bg-gray-800 mx-3" />

      {/* Team 2 */}
      <div className={`flex items-center justify-between px-3 py-2 ${t2Win ? 'bg-gray-800' : ''}`}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t2Color }} />
          <span className={`text-sm font-bold ${!match.t2 ? 'text-gray-600' : t2Win ? 'text-white' : 'text-gray-300'} ${!t2Win && isDone ? 'opacity-50' : ''}`}>
            {match.t2 ? t2Name : 'TBD'}
          </span>
        </div>
        <span className={`text-sm font-black ${t2Win ? 'text-yellow-400' : 'text-gray-600'}`}>{s2}</span>
      </div>

      {/* Simulate button */}
      {!isDone && match.t1 && match.t2 && onSimulate && isNextMatch && (() => {
        const t1Team = teams?.find(t => t.fstId === match.t1);
        const t2Team = teams?.find(t => t.fstId === match.t2);
        const isPlayerMatch = myTeamName && (t1Team?.name === myTeamName || t2Team?.name === myTeamName);
        return (
          <div className="px-3 pb-2 pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onSimulate(match); }}
              className={`w-full text-[10px] font-black uppercase tracking-widest rounded-lg py-1.5 transition active:scale-95 ${
                isPlayerMatch
                  ? 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white animate-pulse'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {isPlayerMatch ? '🎮 경기 시작' : '⚡ 시뮬레이션'}
            </button>
          </div>
        );
      })()}

      {/* Waiting for turn (NEW FIX) */}
      {!isDone && match.t1 && match.t2 && !isNextMatch && (
        <div className="px-3 pb-2 pt-1">
          <div className="w-full text-[10px] font-bold text-center text-gray-500 bg-gray-800 rounded-lg py-1.5 border border-gray-700">
            일정 대기 중
          </div>
        </div>
      )}

      {/* Waiting label */}
      {!isDone && (!match.t1 || !match.t2) && (
        <div className="px-3 pb-2 pt-1">
          <div className="w-full text-[10px] font-bold text-center text-gray-600 bg-gray-800 rounded-lg py-1.5">
            이전 경기 대기 중
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Connector arrow ─────────────────────────────────────────
const Arrow = ({ label, color = 'text-gray-600' }) => (
  <div className={`flex flex-col items-center justify-center mx-1 gap-0.5 ${color}`}>
    <span className="text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">{label}</span>
    <span className="text-lg">→</span>
  </div>
);

// ─── Group section ────────────────────────────────────────────
const GroupSection = ({ group, groupLabel, fst, onSimulate, onMatchClick, myTeamName, nextMatchId }) => {
  const { matches, teams } = fst;
  const isA = groupLabel === 'A';

  const gg1 = findMatch(matches, isA ? 'GG1' : 'GG2');
  const gg2 = findMatch(matches, isA ? 'GG3' : 'GG4');
  const ggW = findMatch(matches, isA ? 'GG5' : 'GG6');  // winners bracket
  const ggL = findMatch(matches, isA ? 'GG8' : 'GG7');  // losers bracket
  const ggE = findMatch(matches, isA ? 'GG9' : 'GG10'); // elimination match

  const ggWDone  = ggW?.status === 'finished';
  const ggEDone  = ggE?.status === 'finished';

  // Who advances from this group?
  const undefeatedAdvances = ggWDone ? getWinnerFstId(ggW, teams) : null;
  const survivorAdvances   = ggEDone ? getWinnerFstId(ggE, teams) : null;
  const eliminated1        = ggL?.status === 'finished' ? getLoserFstId(ggL, teams) : null;
  const eliminated2        = ggEDone ? getLoserFstId(ggE, teams) : null;

  const cfgColor = isA ? 'border-blue-500/30' : 'border-purple-500/30';
  const titleColor = isA ? 'text-blue-400' : 'text-purple-400';
  const dotColor = isA ? 'bg-blue-500' : 'bg-purple-500';

  return (
    <div className={`flex-1 rounded-2xl border ${cfgColor} bg-gray-900/50 p-5`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-3 h-3 rounded-full ${dotColor}`} />
        <h3 className={`text-xl font-black tracking-tight ${titleColor}`}>그룹 {groupLabel}</h3>
        <div className="flex gap-2 flex-wrap">
          {group.map(fstId => (
            <TeamBadge key={fstId} fstId={fstId} teams={teams} size="sm" />
          ))}
        </div>
      </div>

      {/* Bracket rows */}
      <div className="space-y-4">

        {/* ── Wave 1: First matches ── */}
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">1라운드</div>
        <div className="flex items-start gap-3 flex-wrap">
        <FSTMatchCard match={gg1} teams={teams} onSimulate={onSimulate} onMatchClick={onMatchClick} myTeamName={myTeamName} isNextMatch={gg1?.id === nextMatchId} />
        <FSTMatchCard match={gg2} teams={teams} onSimulate={onSimulate} onMatchClick={onMatchClick} myTeamName={myTeamName} isNextMatch={gg2?.id === nextMatchId} />
        </div>

        {/* ── Wave 2: Winner + Loser bracket ── */}
        {(gg1?.status === 'finished' || gg2?.status === 'finished' || ggW || ggL) && (
          <>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 pt-2">2라운드</div>
            <div className="flex items-start gap-3 flex-wrap">
              <div>
                <div className="text-[9px] text-green-500 font-black uppercase mb-1.5">🏆 승자전</div>
                <FSTMatchCard match={ggW} teams={teams} onSimulate={onSimulate} onMatchClick={onMatchClick} myTeamName={myTeamName} pending={!ggW} isNextMatch={ggW?.id === nextMatchId} />
              </div>
              <div>
                <div className="text-[9px] text-orange-500 font-black uppercase mb-1.5">⚡ 패자전</div>
                <FSTMatchCard match={ggL} teams={teams} onSimulate={onSimulate} onMatchClick={onMatchClick} myTeamName={myTeamName} pending={!ggL} isNextMatch={ggL?.id === nextMatchId} />
              </div>
            </div>
          </>
        )}

        {/* ── Wave 3: Elimination ── */}
        {(ggW?.status === 'finished' || ggL?.status === 'finished' || ggE) && (
          <>
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 pt-2">최종전 (탈락 위기)</div>
            <FSTMatchCard match={ggE} teams={teams} onSimulate={onSimulate} onMatchClick={onMatchClick} myTeamName={myTeamName} pending={!ggE} isNextMatch={ggE?.id === nextMatchId} />
          </>
        )}

        {/* ── Advancement summary ── */}
        {(undefeatedAdvances || survivorAdvances || eliminated1 || eliminated2) && (
          <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
            {undefeatedAdvances && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-yellow-400 font-black">→ 플레이오프</span>
                <TeamBadge fstId={undefeatedAdvances} teams={teams} isWinner size="sm" />
                <span className="text-gray-600 text-[10px]">(전승)</span>
              </div>
            )}
            {survivorAdvances && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-blue-400 font-black">→ 플레이오프</span>
                <TeamBadge fstId={survivorAdvances} teams={teams} isWinner size="sm" />
                <span className="text-gray-600 text-[10px]">(생존)</span>
              </div>
            )}
            {eliminated1 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-red-500 font-black">✗ 탈락</span>
                <TeamBadge fstId={eliminated1} teams={teams} isEliminated size="sm" />
              </div>
            )}
            {eliminated2 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-red-500 font-black">✗ 탈락</span>
                <TeamBadge fstId={eliminated2} teams={teams} isEliminated size="sm" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────
const FSTTournamentTab = ({ fst, onSimulate, onMatchClick, onReset, myTeamName }) => {
  const [view, setView] = useState('groups'); // 'groups' | 'playoffs'

  // Chronological strict simulation lock (NEW FIX)
  const nextFSTMatch = fst?.matches
    ?.filter(m => m.status === 'pending' && m.t1 && m.t2)
    .sort((a, b) => {
      const parseDateTime = (m) => {
        const [month, day] = (m.date || '').split(' ')[0].split('.').map(Number);
        const [h, min] = (m.time || '0:00').split(':').map(Number);
        return (month || 0) * 100000 + (day || 0) * 1000 + (h || 0) * 60 + (min || 0);
      };
      return parseDateTime(a) - parseDateTime(b);
    })[0];
  const nextMatchId = nextFSTMatch?.id;

  if (!fst) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500 font-bold text-lg">
        FST 토너먼트 데이터 없음
      </div>
    );
  }

  const { matches, teams, groups, status } = fst;

  const pg1     = findMatch(matches, 'PG1');
  const pg2     = findMatch(matches, 'PG2');
  const finals  = findMatch(matches, 'Finals');
  const pg1Done = pg1?.status === 'finished';
  const pg2Done = pg2?.status === 'finished';
  const finalsDone = finals?.status === 'finished';
  const fstChampFstId = finalsDone ? getWinnerFstId(finals, teams) : null;
  const fstChamp = fstChampFstId ? getTeam(fstChampFstId, teams) : null;

  const playoffsUnlocked = pg1 || pg2 || matches?.some(m => m.fstRound === 'PG1' || m.fstRound === 'PG2');

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-950 to-black border-b border-gray-800">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">🌍</span>
                <div>
                  <h1 className="text-2xl lg:text-4xl font-black tracking-tighter text-white">
                    FST <span className="text-yellow-400">WORLD TOURNAMENT</span>
                  </h1>
                  <p className="text-gray-400 text-sm font-medium mt-0.5">
                    📍 상파울루 라이엇 게임즈 아레나 &nbsp;·&nbsp; BO5 Fearless Draft
                  </p>
                </div>
              </div>

              {/* Patch badge */}
              <div className="flex items-center gap-2 mt-3">
                <span className="bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest">
                  Patch 16.03
                </span>
                <span className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-bold px-3 py-1 rounded-full">
                  {finalsDone ? '🏆 토너먼트 종료' : status === 'group_stage' ? '🔴 LIVE — 그룹 스테이지' : '🔴 LIVE — 플레이오프'}
                </span>
                {onReset && (
                  <button
                    onClick={onReset}
                    className="bg-gray-800 hover:bg-red-900/60 border border-gray-700 hover:border-red-700 text-gray-500 hover:text-red-400 text-xs font-bold px-3 py-1 rounded-full transition"
                    title="FST 데이터 초기화"
                  >
                    🔄 초기화
                  </button>
                )}
              </div>
            </div>

            {/* Participating regions */}
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {Object.entries(LEAGUE_CONFIG).map(([key, cfg]) => (
                <div key={key} className="flex items-center gap-1.5 bg-gray-800/60 border border-gray-700 rounded-lg px-3 py-1.5">
                  <span className="text-base">{cfg.flag}</span>
                  <span className="text-xs font-black text-gray-300">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Champion Banner (when done) ── */}
      {fstChamp && (
        <div className="mx-6 mt-6 rounded-2xl overflow-hidden relative"
          style={{ background: `linear-gradient(135deg, ${fstChamp.colors?.primary}33, ${fstChamp.colors?.primary}11)`, border: `1px solid ${fstChamp.colors?.primary}55` }}>
          <div className="px-8 py-6 flex items-center gap-6">
            <div className="text-5xl">🏆</div>
            <div>
              <div className="text-yellow-400 font-black uppercase tracking-widest text-sm mb-1">FST 세계 챔피언</div>
              <div className="text-3xl font-black text-white">{fstChamp.fullName || fstChamp.name}</div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">{getLeagueCfg(fstChamp.fstId).flag}</span>
                <span className="text-gray-400 font-bold text-sm">{getLeagueCfg(fstChamp.fstId).label} 대표</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Participants grid ── */}
      <div className="px-6 pt-6 pb-2">
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">참가팀</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {teams?.map(t => {
            const cfg   = getLeagueCfg(t.fstId);
            const color = t.colors?.primary || cfg.color;
            const isChamp = t.fstId === fstChampFstId;
            return (
              <div key={t.fstId}
                className={`rounded-xl p-3 text-center border transition ${isChamp ? 'border-yellow-500/60 bg-yellow-500/5' : 'border-gray-800 bg-gray-900/40'}`}>
                <div className="text-2xl mb-1">{cfg.flag}</div>
                <div className="font-black text-sm text-white truncate">{t.name}</div>
                <div className="text-[10px] text-gray-500 font-bold">{cfg.label}</div>
                <div className="text-[9px] font-bold mt-1 px-2 py-0.5 rounded-full inline-block"
                  style={{ backgroundColor: color + '22', color }}>
                  {SLOT_LABEL[t.slot] || t.slot}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── View toggle ── */}
      <div className="px-6 pt-4 pb-2">
        <div className="inline-flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView('groups')}
            className={`px-5 py-2 rounded-lg text-sm font-black transition ${view === 'groups' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            🏟️ 그룹 스테이지
          </button>
          <button
            onClick={() => setView('playoffs')}
            disabled={!playoffsUnlocked}
            className={`px-5 py-2 rounded-lg text-sm font-black transition ${view === 'playoffs' ? 'bg-yellow-500 text-gray-900 shadow-lg' : playoffsUnlocked ? 'text-gray-400 hover:text-white' : 'text-gray-700 cursor-not-allowed'}`}
          >
            👑 플레이오프 & 결승
          </button>
        </div>
      </div>

      {/* ── Group Stage ── */}
      {view === 'groups' && (
        <div className="px-6 py-4">
          <div className="flex flex-col xl:flex-row gap-6">
          {groups?.A && (
              <GroupSection
                group={groups.A}
                groupLabel="A"
                fst={fst}
                onSimulate={onSimulate}
                onMatchClick={onMatchClick}
                myTeamName={myTeamName}
                nextMatchId={nextMatchId}
              />
            )}
            {groups?.B && (
              <GroupSection
                group={groups.B}
                groupLabel="B"
                fst={fst}
                onSimulate={onSimulate}
                onMatchClick={onMatchClick}
                myTeamName={myTeamName}
                nextMatchId={nextMatchId}
              />
            )}
          </div>

          {/* Schedule summary */}
          <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">경기 일정</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {matches?.filter(m => m.type === 'fst' && !['PG1','PG2','Finals'].includes(m.fstRound)).map(m => (
                <div key={m.id}
                  className={`flex items-center justify-between bg-gray-900 border rounded-xl px-4 py-2.5 text-sm
                    ${m.status === 'finished' ? 'border-gray-700 opacity-60' : 'border-gray-700'}`}>
                  <div>
                    <div className="font-black text-white text-xs">{m.label}</div>
                    <div className="text-gray-500 text-[10px]">{m.date} {m.time}</div>
                  </div>
                  <div className="text-right">
                    {m.status === 'finished' ? (
                      <span className="text-green-500 font-black text-xs">✓</span>
                    ) : m.t1 && m.t2 ? (
                      <span className="text-blue-400 font-bold text-[10px]">대기 중</span>
                    ) : (
                      <span className="text-gray-600 font-bold text-[10px]">미정</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Playoffs ── */}
      {view === 'playoffs' && (
        <div className="px-6 py-4">
          {!playoffsUnlocked ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-600">
              <div className="text-5xl mb-4">🔒</div>
              <div className="font-black text-lg">그룹 스테이지 진행 중</div>
              <div className="text-sm mt-1">그룹 스테이지가 끝나면 잠금 해제됩니다</div>
            </div>
          ) : (
            <div className="space-y-6">

              {/* ── Semifinals ── */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">준결승</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
                    <div className="text-xs font-black text-blue-400 uppercase tracking-wider mb-3">준결승 1</div>
                    <div className="text-[10px] text-gray-600 mb-3">
                      그룹 A 전승팀 vs 그룹 B 생존팀
                    </div>
                    <FSTMatchCard match={pg1} teams={teams} onSimulate={onSimulate} onMatchClick={onMatchClick} myTeamName={myTeamName} pending={!pg1} isNextMatch={pg1?.id === nextMatchId} />
                    {pg1 && <div className="text-[10px] text-gray-600 mt-2">{pg1.date} {pg1.time}</div>}
                  </div>

                  <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-5">
                    <div className="text-xs font-black text-purple-400 uppercase tracking-wider mb-3">준결승 2</div>
                    <div className="text-[10px] text-gray-600 mb-3">
                      그룹 B 전승팀 vs 그룹 A 생존팀
                    </div>
                    <FSTMatchCard match={pg2} teams={teams} onSimulate={onSimulate} onMatchClick={onMatchClick} myTeamName={myTeamName} pending={!pg2?.id === nextMatchId} />
                    {pg2 && <div className="text-[10px] text-gray-600 mt-2">{pg2.date} {pg2.time}</div>}
                  </div>
                </div>
              </div>

              {/* ── Grand Final ── */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">🏆 결승전</div>
                <div className={`rounded-2xl overflow-hidden border ${finalsDone ? 'border-yellow-500/40' : 'border-gray-700'} bg-gradient-to-br from-gray-900 to-gray-950`}>
                  <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-3">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <div className="font-black text-white">FST 결승전</div>
                      <div className="text-[10px] text-gray-500">{finals?.date || '3.22 (일)'} {finals?.time || '22:00'} · {finals?.venue || '상파울루 라이엇 게임즈 아레나'}</div>
                    </div>
                  </div>

                  <div className="p-6 flex flex-col items-center gap-4">
                    {!finals && !(pg1Done && pg2Done) ? (
                      <div className="text-gray-600 font-bold text-sm py-8">준결승 완료 후 대진 생성</div>
                    ) : (
                      <FSTMatchCard match={finals} teams={teams} onSimulate={onSimulate} onMatchClick={onMatchClick} myTeamName={myTeamName} pending={!finals} isNextMatch={finals?.id === nextMatchId} />
                    )}

                    {fstChamp && (
                      <div className="text-center mt-4">
                        <div className="text-yellow-400 font-black text-xs uppercase tracking-widest mb-2">🌍 FST 세계 챔피언</div>
                        <TeamBadge fstId={fstChampFstId} teams={teams} isWinner size="lg" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="h-10" />
    </div>
  );
};

export default FSTTournamentTab;