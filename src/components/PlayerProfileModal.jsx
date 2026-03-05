// src/components/PlayerProfileModal.jsx
import React, { useState, useMemo } from 'react';
import accoladesData from '../data/player_accolades.json';

// ─── helpers ────────────────────────────────────────────────
const getOvrColor = (v) => {
    if (v >= 95) return '#ef4444';
    if (v >= 90) return '#f97316';
    if (v >= 85) return '#a855f7';
    if (v >= 80) return '#3b82f6';
    return '#22c55e';
};

const winColor = (wr) => wr >= 60 ? '#22c55e' : wr >= 50 ? '#3b82f6' : wr >= 40 ? '#f97316' : '#ef4444';

const STAT_LABELS = { 라인전: '라인전', 무력: '무력', 한타: '한타', 성장: '성장', 안정성: '안정', 운영: '운영' };

const StatBar = ({ label, value }) => (
    <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 w-10 shrink-0">{label}</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${value || 0}%`, backgroundColor: getOvrColor(value) }}
            />
        </div>
        <span className="text-xs font-black w-7 text-right" style={{ color: getOvrColor(value) }}>{value || '-'}</span>
    </div>
);

// Hex chart (6-axis spider) drawn with SVG
const HexChart = ({ stats }) => {
    const keys = ['라인전', '무력', '한타', '성장', '안정성', '운영'];
    const size = 90;
    const cx = size, cy = size;
    const r = 70;
    const toXY = (i, val) => {
        const angle = (Math.PI * 2 * i) / 6 - Math.PI / 2;
        const dist = (val / 100) * r;
        return [cx + dist * Math.cos(angle), cy + dist * Math.sin(angle)];
    };
    const grid = [100, 75, 50, 25].map(pct =>
        keys.map((_, i) => toXY(i, pct)).map((p, j) => (j === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ') + 'Z'
    );
    const shape = keys.map((k, i) => toXY(i, stats?.[k] || 0)).map((p, j) => (j === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ') + 'Z';
    const labelOffset = 18;
    return (
        <svg width={size * 2} height={size * 2} className="mx-auto">
            {grid.map((d, i) => <path key={i} d={d} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />)}
            {keys.map((_, i) => {
                const [x, y] = toXY(i, 100);
                return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />;
            })}
            <path d={shape} fill="rgba(59,130,246,0.2)" stroke="#3b82f6" strokeWidth="1.5" />
            {keys.map((k, i) => {
                const [x, y] = toXY(i, 100 + labelOffset);
                return <text key={k} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#9ca3af" fontWeight="bold">{STAT_LABELS[k]}</text>;
            })}
        </svg>
    );
};

// ─── extract 2026 match history for a player from league data ─
const extract2026Data = (playerName, league) => {
    const allMatches = [
        ...(league?.matches || []),
        ...(league?.fst?.matches || []),
    ];
    // Also include foreign matches
    if (league?.foreignMatches) {
        Object.values(league.foreignMatches).forEach(ms => allMatches.push(...(ms || [])));
    }

    const games = [];
    let totalK = 0, totalD = 0, totalA = 0, totalGold = 0;
    let wins = 0, pogCount = 0;
    const champMap = {}; // champName -> { games, wins, k, d, a }

    for (const match of allMatches) {
        if (match.status !== 'finished' || !match.result?.history) continue;
        for (const set of match.result.history) {
            const allPicks = [...(set.picks?.A || []), ...(set.picks?.B || [])];
            const pick = allPicks.find(p => p.playerName === playerName);
            if (!pick) continue;

            const k = pick.k ?? pick.stats?.kills ?? 0;
            const d = pick.d ?? pick.stats?.deaths ?? 0;
            const a = pick.a ?? pick.stats?.assists ?? 0;
            const gold = pick.currentGold || 0;

            const playerTeam = pick.playerData?.팀 || pick.playerData?.team || '';
            const isWin = playerTeam && set.winner && (
                String(playerTeam) === String(set.winner) ||
                playerTeam.includes(set.winner) || set.winner.includes(playerTeam)
            );

            const isPog = set.pogPlayer?.playerName === playerName;

            totalK += k; totalD += d; totalA += a; totalGold += gold;
            if (isWin) wins++;
            if (isPog) pogCount++;

            if (pick.champName) {
                if (!champMap[pick.champName]) champMap[pick.champName] = { games: 0, wins: 0, k: 0, d: 0, a: 0 };
                champMap[pick.champName].games++;
                champMap[pick.champName].k += k;
                champMap[pick.champName].d += d;
                champMap[pick.champName].a += a;
                if (isWin) champMap[pick.champName].wins++;
            }

            // Determine opponent
            const sideA = set.picks?.A || [];
            const sideB = set.picks?.B || [];
            const playerOnA = sideA.some(p => p.playerName === playerName);
            const opponentTeam = playerOnA
                ? (sideB[0]?.playerData?.팀 || sideB[0]?.playerData?.team || '?')
                : (sideA[0]?.playerData?.팀 || sideA[0]?.playerData?.team || '?');

            games.push({
                date: match.date || '',
                champ: pick.champName || '?',
                k, d, a,
                gold,
                result: isWin ? 'WIN' : 'LOSS',
                pog: isPog,
                opponent: opponentTeam,
                matchType: match.type || match.fstRound || 'regular',
                setNum: set.setNumber || '',
            });
        }
    }

    const totalGames = games.length;
    const champStats = Object.entries(champMap)
        .map(([name, s]) => ({
            name,
            games: s.games,
            wins: s.wins,
            winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
            kda: s.d > 0 ? ((s.k + s.a) / s.d).toFixed(2) : 'Perfect',
        }))
        .sort((a, b) => b.games - a.games);

    return {
        games: games.reverse(), // most recent first
        totalGames,
        wins,
        losses: totalGames - wins,
        winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
        avgK: totalGames > 0 ? (totalK / totalGames).toFixed(1) : '0.0',
        avgD: totalGames > 0 ? (totalD / totalGames).toFixed(1) : '0.0',
        avgA: totalGames > 0 ? (totalA / totalGames).toFixed(1) : '0.0',
        kda: totalD > 0 ? ((totalK + totalA) / totalD).toFixed(2) : 'Perfect',
        avgGold: totalGames > 0 ? Math.round(totalGold / totalGames) : 0,
        pogCount,
        champStats,
    };
};

// ─── main modal ─────────────────────────────────────────────
export default function PlayerProfileModal({ player, league, masteryData, onClose }) {
    const [tab, setTab] = useState('overview');

    const accolades = useMemo(() => {
        if (!player) return null;
        return accoladesData.find(a =>
            a.id === player.id ||
            a.name === player.이름 ||
            a.id === player.이름
        ) || null;
    }, [player]);

    const data2026 = useMemo(() => {
        if (!player || !league) return null;
        return extract2026Data(player.이름, league);
    }, [player, league]);

    const masteryEntry = useMemo(() => {
        if (!player || !masteryData) return null;
        return masteryData.find(m => m.name === player.이름 || m.id === player.id) || null;
    }, [player, masteryData]);

    const careerPool = useMemo(() => {
        if (!masteryEntry) return [];
        return masteryEntry.pool
            .filter(p => p.category === 'Career')
            .sort((a, b) => b.games - a.games);
    }, [masteryEntry]);

    const season2025Pool = useMemo(() => {
        if (!masteryEntry) return [];
        return masteryEntry.pool
            .filter(p => p.category === 'Season 2025')
            .sort((a, b) => b.games - a.games);
    }, [masteryEntry]);

    if (!player) return null;

    const teamColor = player.playerData?.colors?.primary || '#3b82f6';
    const posLabel = player.포지션 || player.position || player.role || '';

    const TABS = [
        { id: 'overview',  label: '개요' },
        { id: 'matches',   label: '2026 경기기록' },
        { id: 'champions', label: '챔피언 풀' },
        { id: 'accolades', label: '수상경력' },
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">

                {/* ── Header ── */}
                <div className="relative flex items-center gap-4 p-4 sm:p-6 shrink-0 overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${teamColor}22, ${teamColor}08)`, borderBottom: `2px solid ${teamColor}30` }}>
                    <div className="absolute inset-0 opacity-5" style={{ backgroundImage: `radial-gradient(circle at 80% 50%, ${teamColor}, transparent 60%)` }} />

                    {/* Avatar */}
                    <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-black text-white text-xl sm:text-3xl shrink-0 shadow-lg z-10"
                        style={{ backgroundColor: teamColor }}>
                        {player.이름?.charAt(0) || '?'}
                    </div>

                    <div className="z-10 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl sm:text-3xl font-black text-gray-900 leading-tight">{player.이름}</h2>
                            {player.주장 && <span className="text-yellow-500 text-lg">👑</span>}
                            <span className="text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: teamColor }}>{posLabel}</span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-500 font-medium mt-0.5">{player.팀} · {player.특성 || ''}</div>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="text-lg sm:text-2xl font-black" style={{ color: getOvrColor(player.종합) }}>{player.종합} <span className="text-xs font-bold text-gray-400">OVR</span></span>
                            {player.잠재력 && <span className="text-xs font-bold text-purple-500">POT {player.잠재력}</span>}
                            {player.나이 && <span className="text-xs text-gray-400">만 {player.나이}세</span>}
                            {player.경력 && <span className="text-xs text-gray-400">경력 {player.경력}년</span>}
                        </div>
                    </div>

                    {/* 2026 quick stats */}
                    {data2026 && data2026.totalGames > 0 && (
                        <div className="z-10 hidden sm:flex flex-col items-end gap-1 shrink-0">
                            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">2026 시즌</div>
                            <div className="text-lg font-black" style={{ color: winColor(data2026.winRate) }}>{data2026.winRate}% WR</div>
                            <div className="text-xs font-mono text-gray-600">{data2026.avgK}/{data2026.avgD}/{data2026.avgA}</div>
                            <div className="text-[10px] text-gray-400">{data2026.totalGames}경기 · POG {data2026.pogCount}</div>
                        </div>
                    )}

                    <button onClick={onClose}
                        className="z-10 ml-auto sm:ml-0 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-black transition shrink-0">
                        ✕
                    </button>
                </div>

                {/* ── Tab bar ── */}
                <div className="flex border-b bg-gray-50 shrink-0 overflow-x-auto">
                    {TABS.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 sm:px-6 py-2.5 sm:py-3 font-bold text-xs sm:text-sm whitespace-nowrap transition-all border-b-2 ${
                                tab === t.id ? 'border-blue-500 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                            }`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ── Content ── */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">

                    {/* ═══ OVERVIEW ═══ */}
                    {tab === 'overview' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Hex chart + stat bars */}
                            <div className="bg-white rounded-xl p-4 border shadow-sm">
                                <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">능력치</div>
                                <HexChart stats={player.상세} />
                                <div className="mt-3 space-y-1.5">
                                    {Object.entries(player.상세 || {}).map(([k, v]) => (
                                        <StatBar key={k} label={STAT_LABELS[k] || k} value={v} />
                                    ))}
                                </div>
                            </div>

                            {/* Info + 2026 summary */}
                            <div className="flex flex-col gap-4">
                                {/* Personal info */}
                                <div className="bg-white rounded-xl p-4 border shadow-sm">
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">선수 정보</div>
                                    <div className="space-y-2 text-sm">
                                        {[
                                            ['팀', player.팀],
                                            ['포지션', posLabel],
                                            ['나이', player.나이 ? `만 ${player.나이}세` : '-'],
                                            ['경력', player.경력 ? `${player.경력}년` : '-'],
                                            ['소속기간', player['팀 소속기간'] || '-'],
                                            ['연봉', player.연봉 || '-'],
                                            ['계약', player.계약 || '-'],
                                        ].map(([label, val]) => (
                                            <div key={label} className="flex justify-between">
                                                <span className="text-gray-400 font-medium">{label}</span>
                                                <span className="font-bold text-gray-800">{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 2026 stats summary */}
                                {data2026 && data2026.totalGames > 0 ? (
                                    <div className="bg-white rounded-xl p-4 border shadow-sm">
                                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">2026 시즌 요약</div>
                                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                                            {[
                                                ['경기', data2026.totalGames],
                                                ['승', data2026.wins],
                                                ['패', data2026.losses],
                                            ].map(([l, v]) => (
                                                <div key={l} className="bg-gray-50 rounded-lg p-2">
                                                    <div className="text-lg font-black text-gray-800">{v}</div>
                                                    <div className="text-[10px] text-gray-400 font-bold">{l}</div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-center">
                                            {[
                                                ['승률', `${data2026.winRate}%`, winColor(data2026.winRate)],
                                                ['KDA', data2026.kda, '#6366f1'],
                                                ['평균 K/D/A', `${data2026.avgK}/${data2026.avgD}/${data2026.avgA}`, '#374151'],
                                                ['POG', data2026.pogCount, '#f59e0b'],
                                            ].map(([l, v, c]) => (
                                                <div key={l} className="bg-gray-50 rounded-lg p-2">
                                                    <div className="text-sm font-black" style={{ color: c }}>{v}</div>
                                                    <div className="text-[10px] text-gray-400 font-bold">{l}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white rounded-xl p-4 border shadow-sm">
                                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">2026 시즌</div>
                                        <div className="text-sm text-gray-400 text-center py-4">아직 경기 데이터가 없습니다</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ MATCH HISTORY ═══ */}
                    {tab === 'matches' && (
                        <div>
                            {data2026 && data2026.totalGames > 0 ? (
                                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b">
                                            <tr>
                                                <th className="py-2.5 px-3 text-left font-black text-gray-400 uppercase tracking-widest">날짜</th>
                                                <th className="py-2.5 px-3 text-left font-black text-gray-400 uppercase tracking-widest">챔피언</th>
                                                <th className="py-2.5 px-3 text-center font-black text-gray-400 uppercase tracking-widest">결과</th>
                                                <th className="py-2.5 px-3 text-center font-black text-gray-400 uppercase tracking-widest">K/D/A</th>
                                                <th className="py-2.5 px-3 text-center font-black text-gray-400 uppercase tracking-widest hidden sm:table-cell">골드</th>
                                                <th className="py-2.5 px-3 text-left font-black text-gray-400 uppercase tracking-widest hidden sm:table-cell">상대팀</th>
                                                <th className="py-2.5 px-3 text-center font-black text-gray-400 uppercase tracking-widest">POG</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {data2026.games.map((g, i) => (
                                                <tr key={i} className={`transition hover:bg-gray-50 ${g.result === 'WIN' ? 'border-l-2 border-l-green-400' : 'border-l-2 border-l-red-300'}`}>
                                                    <td className="py-2 px-3 text-gray-500">{g.date}</td>
                                                    <td className="py-2 px-3 font-bold text-gray-800">{g.champ}</td>
                                                    <td className="py-2 px-3 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${g.result === 'WIN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                                                            {g.result}
                                                        </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-mono font-bold text-gray-700">
                                                        {g.k}/<span className="text-red-500">{g.d}</span>/{g.a}
                                                    </td>
                                                    <td className="py-2 px-3 text-center text-gray-500 hidden sm:table-cell">
                                                        {g.gold > 0 ? `${(g.gold / 1000).toFixed(1)}k` : '-'}
                                                    </td>
                                                    <td className="py-2 px-3 text-gray-600 hidden sm:table-cell">{g.opponent}</td>
                                                    <td className="py-2 px-3 text-center">
                                                        {g.pog && <span className="text-yellow-500 text-base">⭐</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border p-12 text-center text-gray-400 font-bold shadow-sm">
                                    <div className="text-4xl mb-3">🎮</div>
                                    2026 시즌 경기 데이터가 없습니다.
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ CHAMPION POOL ═══ */}
                    {tab === 'champions' && (
                        <div className="space-y-4">
                            {/* 2026 pool (from live match data) */}
                            {data2026 && data2026.champStats.length > 0 && (
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Season 2026</div>
                                    <ChampTable champs={data2026.champStats} highlight />
                                </div>
                            )}

                            {/* 2025 pool */}
                            {season2025Pool.length > 0 && (
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Season 2025</div>
                                    <ChampTable champs={season2025Pool} />
                                </div>
                            )}

                            {/* Career pool */}
                            {careerPool.length > 0 && (
                                <div>
                                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Career</div>
                                    <ChampTable champs={careerPool} />
                                </div>
                            )}

                            {!masteryEntry && data2026?.champStats.length === 0 && (
                                <div className="bg-white rounded-xl border p-12 text-center text-gray-400 font-bold shadow-sm">
                                    <div className="text-4xl mb-3">📊</div>
                                    챔피언 풀 데이터가 없습니다.
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══ ACCOLADES ═══ */}
                    {tab === 'accolades' && (
                        <div>
                            {accolades ? (
                                <div className="space-y-4">
                                    {/* Title badges */}
                                    <div className="bg-white rounded-xl p-4 border shadow-sm">
                                        <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">팀 우승 기록</div>
                                        <div className="flex flex-wrap gap-3">
                                            {accolades.team_titles.worlds > 0 && (
                                                <TrophyBadge icon="🌍" label="월드 챔피언십" count={accolades.team_titles.worlds} color="#f59e0b" />
                                            )}
                                            {accolades.team_titles.msi > 0 && (
                                                <TrophyBadge icon="🌐" label="MSI" count={accolades.team_titles.msi} color="#6366f1" />
                                            )}
                                            {accolades.team_titles.lck > 0 && (
                                                <TrophyBadge icon="🏆" label="LCK 우승" count={accolades.team_titles.lck} color="#3b82f6" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Individual awards */}
                                    {accolades.individual_awards?.length > 0 && (
                                        <div className="bg-white rounded-xl p-4 border shadow-sm">
                                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">개인 수상</div>
                                            <div className="space-y-2">
                                                {[...accolades.individual_awards].reverse().map((aw, i) => (
                                                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                                                        <span className="text-xs font-black text-gray-400 w-12 shrink-0">{aw.year}</span>
                                                        <span className="text-yellow-500">🎖️</span>
                                                        <span className="text-sm font-bold text-gray-700">{aw.award}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Career stats */}
                                    {accolades.career_stats && (
                                        <div className="bg-white rounded-xl p-4 border shadow-sm">
                                            <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">커리어 통계</div>
                                            <div className="flex gap-4">
                                                {accolades.career_stats.pro_years && (
                                                    <div className="text-center">
                                                        <div className="text-2xl font-black text-blue-600">{accolades.career_stats.pro_years}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold">프로 경력</div>
                                                    </div>
                                                )}
                                                {accolades.career_stats.total_worlds && (
                                                    <div className="text-center">
                                                        <div className="text-2xl font-black text-purple-600">{accolades.career_stats.total_worlds}</div>
                                                        <div className="text-[10px] text-gray-400 font-bold">월즈 출전</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border p-12 text-center text-gray-400 font-bold shadow-sm">
                                    <div className="text-4xl mb-3">🏅</div>
                                    수상 데이터가 없습니다.<br/>
                                    <span className="text-xs font-normal">player_accolades.json에 추가해주세요.</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── sub-components ──────────────────────────────────────────
function ChampTable({ champs, highlight }) {
    return (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b">
                    <tr>
                        <th className="py-2 px-3 text-left font-black text-gray-400 uppercase tracking-widest">챔피언</th>
                        <th className="py-2 px-3 text-center font-black text-gray-400 uppercase tracking-widest">경기</th>
                        <th className="py-2 px-3 text-center font-black text-gray-400 uppercase tracking-widest">승률</th>
                        <th className="py-2 px-3 text-center font-black text-gray-400 uppercase tracking-widest">KDA</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {champs.map((c, i) => (
                        <tr key={c.name} className={`transition hover:bg-gray-50 ${highlight && i === 0 ? 'bg-blue-50/50' : ''}`}>
                            <td className="py-2 px-3 font-bold text-gray-800 flex items-center gap-2">
                                {highlight && i < 3 && <span className="text-[10px] font-black text-blue-400">#{i+1}</span>}
                                {c.name}
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-gray-600">{c.games}</td>
                            <td className="py-2 px-3 text-center">
                                <span className="font-black" style={{ color: winColor(c.winRate) }}>{c.winRate}%</span>
                            </td>
                            <td className="py-2 px-3 text-center font-mono font-bold text-indigo-600">{c.kda}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function TrophyBadge({ icon, label, count, color }) {
    return (
        <div className="flex flex-col items-center gap-1 bg-gray-50 rounded-xl p-3 border min-w-[80px]">
            <span className="text-2xl">{icon}</span>
            <span className="text-2xl font-black" style={{ color }}>×{count}</span>
            <span className="text-[10px] font-bold text-gray-500 text-center leading-tight">{label}</span>
        </div>
    );
}