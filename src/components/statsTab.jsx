import React, { useMemo, useState } from 'react';
import computeStatsForLeague from '../engine/statsManager';

const ROLE_TABS = ['ALL', 'TOP', 'JGL', 'MID', 'ADC', 'SUP'];

export default function StatsTab({ league }) {
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [regularOnly, setRegularOnly] = useState(false);
  const [champSortKey, setChampSortKey] = useState('pickCount'); // pickCount | winRate | banCount
  const [showAllChampions, setShowAllChampions] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(false);

  const stats = useMemo(() => {
    if (!league) return null;
    try {
      return computeStatsForLeague(league, { regularOnly, roleFilter });
    } catch (err) {
      console.error('Stats computation failed:', err);
      return null;
    }
  }, [league, regularOnly, roleFilter]);

  if (!league) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex items-center justify-center text-gray-500">
        리그 데이터를 불러오는 중입니다...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex items-center justify-center text-red-500">
        통계 계산 중 오류가 발생했습니다.
      </div>
    );
  }

  const { pogLeaderboard, playerRatings, meta, kda } = stats;
  const champList = meta.championMeta || [];

  const champSorted = [...champList].sort((a, b) => {
    if (champSortKey === 'winRate') return (b.winRate || 0) - (a.winRate || 0);
    if (champSortKey === 'banCount') return (b.banCount || 0) - (a.banCount || 0);
    // default pickCount
    return (b.pickCount || 0) - (a.pickCount || 0);
  });

  const topPogs = pogLeaderboard.slice(0, 50);
  const topPlayers = (playerRatings || []).slice(0, showAllPlayers ? 500 : 50);
  const topChampions = champSorted.slice(0, showAllChampions ? champSorted.length : 50);

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[600px] flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">📊 통계 / 리그 분석</h2>
          <p className="text-sm text-gray-500 mt-1">POG, 선수 평점, 챔피언 메타, KDA 리더 등</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">Regular only</label>
            <input type="checkbox" checked={regularOnly} onChange={(e) => setRegularOnly(e.target.checked)} className="h-4 w-4" />
          </div>

          <div className="bg-gray-50 p-2 rounded flex items-center gap-2">
            <span className="text-xs text-gray-600 uppercase font-bold">Role</span>
            <div className="flex gap-1">
              {ROLE_TABS.map(r => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1 rounded text-sm font-bold ${roleFilter === r ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: POG + small summary cards */}
        <div className="col-span-1 space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-gray-800">🏅 POG Leaderboard</h3>
              <span className="text-xs text-gray-500">총 세트: {stats.meta?.totalSets ?? 0}</span>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {topPogs.length === 0 && <div className="text-sm text-gray-500">POG 데이터가 없습니다.</div>}
              {topPogs.map((p, idx) => (
                <div key={p.playerName} className="flex items-center justify-between bg-white p-2 rounded shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700">{idx + 1}</div>
                    <div>
                      <div className="font-bold text-sm">{p.playerName}</div>
                      <div className="text-xs text-gray-400">{(p.teams || []).slice(0,2).join(', ')}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-lg text-yellow-600">{p.pogs}</div>
                    {p.lastScore ? <div className="text-xs text-gray-400">Last: {p.lastScore.toFixed(1)}</div> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <h3 className="font-black text-gray-800 mb-2">Summary</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Sets Analyzed</div>
                <div className="font-bold text-lg">{stats.meta?.totalSets ?? 0}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Unique Players</div>
                <div className="font-bold text-lg">{playerRatings.length}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">Champions Seen</div>
                <div className="font-bold text-lg">{(meta.championMeta || []).length}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-xs text-gray-500">KDA Records</div>
                <div className="font-bold text-lg">{kda.byKills.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle column: Player Ratings */}
        <div className="col-span-1 lg:col-span-1">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-gray-800">⭐ Player Ratings (avg score)</h3>
              <button onClick={() => setShowAllPlayers(s => !s)} className="text-xs text-gray-600 underline">
                {showAllPlayers ? 'Show top 50' : 'Show all'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500">
                  <tr>
                    <th className="p-2 w-12">#</th>
                    <th className="p-2">Player</th>
                    <th className="p-2 text-right">Avg</th>
                    <th className="p-2 text-right">Games</th>
                    <th className="p-2">Roles</th>
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((p, i) => (
                    <tr key={p.playerName} className="border-t">
                      <td className="p-2 font-bold text-gray-600">{i + 1}</td>
                      <td className="p-2 font-bold">{p.playerName}</td>
                      <td className="p-2 text-right font-mono">{(p.avgScore || 0).toFixed(2)}</td>
                      <td className="p-2 text-right">{p.games}</td>
                      <td className="p-2">
                        <div className="text-xs text-gray-500">
                          {Object.entries(p.roles || {}).map(([r, cnt]) => `${r}:${cnt}`).join(' • ')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

        {/* Right column: Champion Meta + KDA leaders */}
        <div className="col-span-1 lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-gray-800">🧭 Champion Meta</h3>
              <div className="flex items-center gap-2">
                <select value={champSortKey} onChange={(e) => setChampSortKey(e.target.value)} className="text-sm p-1 border rounded">
                  <option value="pickCount">Pick Count</option>
                  <option value="winRate">Win Rate</option>
                  <option value="banCount">Ban Count</option>
                </select>
                <button onClick={() => setShowAllChampions(s => !s)} className="text-xs text-gray-600 underline">
                  {showAllChampions ? 'Collapse' : 'Show all'}
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 text-left">
                  <tr>
                    <th className="p-2 w-8">#</th>
                    <th className="p-2">Champion</th>
                    <th className="p-2 text-right">Picks</th>
                    <th className="p-2 text-right">Bans</th>
                    <th className="p-2 text-right">Wins</th>
                    <th className="p-2 text-right">Win%</th>
                    <th className="p-2 text-right">Pick%</th>
                    <th className="p-2 text-right">Ban%</th>
                  </tr>
                </thead>
                <tbody>
                  {topChampions.map((c, idx) => (
                    <tr key={c.champName} className="border-t">
                      <td className="p-2 font-bold">{idx + 1}</td>
                      <td className="p-2">{c.champName}</td>
                      <td className="p-2 text-right font-mono">{c.pickCount}</td>
                      <td className="p-2 text-right font-mono">{c.banCount}</td>
                      <td className="p-2 text-right font-mono">{c.winCount}</td>
                      <td className="p-2 text-right">{(c.winRate * 100).toFixed(1)}%</td>
                      <td className="p-2 text-right">{(c.pickRate * 100).toFixed(1)}%</td>
                      <td className="p-2 text-right">{(c.banRate * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-gray-800">⚔️ KDA Leaders</h3>
              <div className="text-xs text-gray-500">top 10</div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1 font-bold">By Kills</div>
                <ol className="list-decimal list-inside space-y-1">
                  {kda.byKills.slice(0,10).map((p, i) => (
                    <li key={p.playerName} className="flex justify-between">
                      <span>{p.playerName} <span className="text-xs text-gray-400">({p.games}g)</span></span>
                      <span className="font-mono">{p.kills} / {p.deaths} / {p.assists}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1 font-bold">By KDA</div>
                <ol className="list-decimal list-inside space-y-1">
                  {kda.byKda.slice(0,10).map((p) => (
                    <li key={p.playerName} className="flex justify-between">
                      <span>{p.playerName} <span className="text-xs text-gray-400">({p.games}g)</span></span>
                      <span className="font-mono">{p.kda.toFixed(2)} (KDA)</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1 font-bold">By Assists</div>
                <ol className="list-decimal list-inside space-y-1">
                  {kda.byAssists.slice(0,10).map((p) => (
                    <li key={p.playerName} className="flex justify-between">
                      <span>{p.playerName} <span className="text-xs text-gray-400">({p.games}g)</span></span>
                      <span className="font-mono">{p.assists} A</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}