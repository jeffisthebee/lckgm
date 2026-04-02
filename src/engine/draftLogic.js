// src/engine/draftLogic.js
import { DRAFT_SEQUENCE } from '../data/constants';
import { MASTERY_MAP, calculateChampionScore } from './mechanics';
import { SYNERGIES } from '../data/synergies';

// --- ENGLISH → KOREAN CHAMPION NAME MAP ---
// Built from champions.json ids so it stays in sync when new champs are added.
// Mastery data uses English names; champions.json uses Korean names.
// This bridges the two.
const ENG_TO_KOR = {
  "Aatrox": "아트록스",
  "Ahri": "아리",
  "Akali": "아칼리",
  "Akshan": "아크샨",
  "Alistar": "알리스타",
  "Ambessa": "암베사",
  "Amumu": "아무무",
  "Anivia": "애니비아",
  "Annie": "애니",
  "Aphelios": "아펠리오스",
  "Ashe": "애쉬",
  "Aurelion Sol": "아우렐리온 솔",
  "Aurora": "오로라",
  "Azir": "아지르",
  "Bard": "바드",
  "Bel'Veth": "벨베스",
  "Blitzcrank": "블리츠크랭크",
  "Brand": "브랜드",
  "Braum": "브라움",
  "Briar": "브라이어",
  "Caitlyn": "케이틀린",
  "Camille": "카밀",
  "Cassiopeia": "카시오페아",
  "Chogath": "초가스",
  "Cho'Gath": "초가스",
  "Corki": "코르키",
  "Darius": "다리우스",
  "Diana": "다이애나",
  "Dr. Mundo": "문도 박사",
  "Draven": "드레이븐",
  "Ekko": "에코",
  "Elise": "엘리스",
  "Evelynn": "이블린",
  "Ezreal": "이즈리얼",
  "Fiddlesticks": "피들스틱",
  "Fiora": "피오라",
  "Fizz": "피즈",
  "Galio": "갈리오",
  "Gangplank": "갱플랭크",
  "Garen": "가렌",
  "Gnar": "나르",
  "Gragas": "그라가스",
  "Graves": "그레이브즈",
  "Gwen": "그웬",
  "Hecarim": "헤카림",
  "Heimerdinger": "하이머딩거",
  "Hwei": "흐웨이",
  "Illaoi": "일라오이",
  "Irelia": "이렐리아",
  "Ivern": "아이번",
  "Janna": "잔나",
  "Jarvan IV": "자르반 4세",
  "Jax": "잭스",
  "Jayce": "제이스",
  "Jhin": "진",
  "Jinx": "징크스",
  "Kai'Sa": "카이사",
  "Kaisa": "카이사",
  "Kalista": "칼리스타",
  "Karma": "카르마",
  "Karthus": "카서스",
  "Kassadin": "카사딘",
  "Katarina": "카타리나",
  "Kayle": "케일",
  "Kayn": "케인",
  "Kennen": "케넨",
  "Kha'Zix": "카직스",
  "KhaZix": "카직스",
  "Kindred": "킨드레드",
  "Kled": "클레드",
  "Kog'Maw": "코그모",
  "KogMaw": "코그모",
  "KSante": "크산테",
  "Ksante": "크산테",
  "LeBlanc": "르블랑",
  "Leblanc": "르블랑",
  "Lee Sin": "리 신",
  "Leona": "레오나",
  "Lillia": "릴리아",
  "Lissandra": "리산드라",
  "Lucian": "루시안",
  "Lulu": "룰루",
  "Lux": "럭스",
  "Malphite": "말파이트",
  "Malzahar": "말자하",
  "Maokai": "마오카이",
  "Master Yi": "마스터 이",
  "Mel": "멜",
  "Milio": "밀리오",
  "Miss Fortune": "미스 포츈",
  "MissFortune": "미스 포츈",
  "Mordekaiser": "모데카이저",
  "Morgana": "모르가나",
  "Naafiri": "나피리",
  "Nami": "나미",
  "Nasus": "나서스",
  "Nautilus": "노틸러스",
  "Neeko": "니코",
  "Nidalee": "니달리",
  "Nilah": "닐라",
  "Nocturne": "녹턴",
  "Nunu & Willump": "누누와 윌럼프",
  "Olaf": "올라프",
  "Orianna": "오리아나",
  "Ornn": "오른",
  "Pantheon": "판테온",
  "Poppy": "뽀삐",
  "Pyke": "파이크",
  "Qiyana": "키아나",
  "Quinn": "퀸",
  "Rakan": "라칸",
  "Rammus": "람머스",
  "Rek'Sai": "렉사이",
  "RekSai": "렉사이",
  "Rell": "렐",
  "Renata Glasc": "레나타 글라스크",
  "Renekton": "레넥톤",
  "Rengar": "렝가",
  "Riven": "리븐",
  "Rumble": "럼블",
  "Ryze": "라이즈",
  "Samira": "사미라",
  "Sejuani": "세주아니",
  "Senna": "세나",
  "Seraphine": "세라핀",
  "Sett": "세트",
  "Shaco": "샤코",
  "Shen": "쉔",
  "Shyvana": "쉬바나",
  "Singed": "신지드",
  "Sion": "사이온",
  "Sivir": "시비르",
  "Skarner": "스카너",
  "Smolder": "스몰더",
  "Sona": "소나",
  "Soraka": "소라카",
  "Swain": "스웨인",
  "Sylas": "사일러스",
  "Syndra": "신드라",
  "Tahm Kench": "탐 켄치",
  "TahmKench": "탐 켄치",
  "Taliyah": "탈리야",
  "Talon": "탈론",
  "Taric": "타릭",
  "Teemo": "티모",
  "Thresh": "쓰레쉬",
  "Tristana": "트리스타나",
  "Trundle": "트런들",
  "Tryndamere": "트린다미어",
  "Twisted Fate": "트위스티드 페이트",
  "TwistedFate": "트위스티드 페이트",
  "Twitch": "트위치",
  "Udyr": "우디르",
  "Urgot": "우르곳",
  "Varus": "바루스",
  "Vayne": "베인",
  "Veigar": "베이가",
  "Vel'Koz": "벨코즈",
  "Velkoz": "벨코즈",
  "Vex": "벡스",
  "Vi": "바이",
  "Viego": "비에고",
  "Viktor": "빅토르",
  "Vladimir": "블라디미르",
  "Volibear": "볼리베어",
  "Warwick": "워윅",
  "Wukong": "오공",
  "Xayah": "자야",
  "Xerath": "제라스",
  "Xin Zhao": "신 짜오",
  "XinZhao": "신 짜오",
  "Yasuo": "야스오",
  "Yone": "요네",
  "Yorick": "요릭",
  "Yunara": "유나라",
  "Yuumi": "유미",
  "Zaahen": "자헨",
  "Zac": "자크",
  "Zed": "제드",
  "Zeri": "제리",
  "Ziggs": "직스",
  "Zilean": "질리언",
  "Zoe": "조이",
  "Zyra": "자이라",
};

// Lookup: given an English mastery name, return the Korean champion name used in champions.json
const toKor = (engName) => ENG_TO_KOR[engName] || null;

const getKnownPool = (playerData) => {
  if (!playerData?.pool) return new Set();
  const known = new Set();
  playerData.pool.forEach(m => {
    const korName = toKor(m.name);
    if (!korName) return;
    const isSeason = m.source === 'season' || m.category === 'Season 2025';
    const isCareer = m.source === 'career' || m.source === 'blended' || m.category === 'Career';
    if (isSeason && m.games >= 3) known.add(korName);
    else if (isCareer && m.games >= 5) known.add(korName);
  });
  return known;
};

const findMastery = (playerData, korChampName) => {
  if (!playerData?.pool) return null;
  return playerData.pool.find(m => toKor(m.name) === korChampName) || null;
};

const PICK_PHASE_WEIGHTS = {
  1: { mastery: 1.25, counter: 0.50, synergy: 0.75,  versatility: 1.25 },
  2: { mastery: 1.00, counter: 1.00, synergy: 1.25,  versatility: 1.00 },
  3: { mastery: 0.75, counter: 1.75, synergy: 1.50,  versatility: 0.75 },
};

const getPickPhase = (order) => {
  if (order <= 11) return 1;
  if (order <= 14) return 2;
  return 3;
};

// ─────────────────────────────────────────────────────────────
// [FIX] Validate and sanitize champion list before using it
// ─────────────────────────────────────────────────────────────
const validateChampionList = (champList) => {
  // Ensure it's an array with valid champion objects
  if (!Array.isArray(champList) || champList.length === 0) {
    console.warn('Invalid champion list provided, using fallback');
    return [];
  }
  
  // Validate each champion has required fields (name, tier, role)
  return champList.filter(c => {
    return c && c.name && (c.tier !== undefined && c.tier !== null) && c.role;
  });
};

export function selectPickFromTop3(player, availableChampions, currentTeamPicks = [], enemyTeamPicks = [], pickOrder = 7, fearlessBans = []) {
  const phase = getPickPhase(pickOrder);
  const pw    = PICK_PHASE_WEIGHTS[phase];

  const playerData = MASTERY_MAP[player.이름];
  const knownPool = getKnownPool(playerData);

  // [FIX] Validate available champions before filtering
  const validChampions = validateChampionList(availableChampions);
  
  // Filter to role-appropriate champions
  const roleChamps = validChampions.filter(c => c.role === player.포지션);
  const basePool = roleChamps.length > 0 ? roleChamps : validChampions;

  if (basePool.length === 0) return null;

  // Split into known (in mastery pool) and unknown
  const knownChamps   = basePool.filter(c => knownPool.has(c.name));
  const unknownChamps = basePool.filter(c => !knownPool.has(c.name));

  const MIN_POOL = 3;
  const pool = knownChamps.length >= MIN_POOL
    ? knownChamps
    : [...knownChamps, ...unknownChamps].slice(0, Math.max(MIN_POOL, knownChamps.length));

  const availableNames   = new Set(validChampions.map(c => c.name));
  const currentTeamNames = currentTeamPicks.map(c => c.name);

  const currentAD = currentTeamPicks.filter(c => c.dmg_type === 'AD').length;
  const currentAP = currentTeamPicks.filter(c => c.dmg_type === 'AP').length;

  const fearlessSet = new Set(fearlessBans);
  const remainingKnown = [...knownPool].filter(name => !fearlessSet.has(name));
  const isConservationMode = remainingKnown.length <= 3;
  
  const getFearlessBonus = (champName) => {
    if (!isConservationMode) return 1.0;
    if (fearlessSet.has(champName)) return 0.0;
    if (knownPool.has(champName)) return 1.3;
    return 0.5;
  };

  const scoredChamps = pool.map(champ => {
    const isKnown = knownPool.has(champ.name);
    const mastery = findMastery(playerData, champ.name);

    const effectiveMastery = isKnown ? mastery : null;
    let score = calculateChampionScore(
      player,
      champ,
      effectiveMastery,
      isKnown ? 1.0 : 0.3
    );
    score *= pw.mastery;
    score *= getFearlessBonus(champ.name);

    // --- [STEP 0] Tier Weighting + Versatility ---
    // [FIX] Always use the current champion's tier value from the list
    // This ensures meta shifts are respected - NO FALLBACK to old tier data
    const tierChamp = validChampions.find(c => c.name === champ.name);
    const currentTier = tierChamp?.tier ?? 3; // Only fallback to default tier, not old champ.tier
    
    const statsSum = (champ.stats ? Object.values(champ.stats).reduce((a, v) => a + v, 0) : 0);
    const versatilityScore = statsSum / 50;
    score += versatilityScore * pw.versatility;

    let tierMultiplier = 1.0;
    switch (currentTier) {  // Use currentTier (fresh lookup)
      case 1: tierMultiplier = 1.25; break;
      case 2: tierMultiplier = 1.1; break;
      case 3: tierMultiplier = 1.00; break;
      case 4: tierMultiplier = 0.90; break;
      case 5: tierMultiplier = 0.75; break;
      default: tierMultiplier = 1.0;
    }
    score *= tierMultiplier;

    // --- [STEP 1] Damage Profile Balance ---
    if (currentTeamPicks.length >= 3) {
      let compMultiplier = 1.0;
      if (currentAD >= 4 && champ.dmg_type === 'AD') compMultiplier = 0.5;
      if (currentAP >= 4 && champ.dmg_type === 'AP') compMultiplier = 0.5;
      if (currentAP === 0 && champ.dmg_type === 'AP') compMultiplier = 1.5;
      if (currentAD === 0 && champ.dmg_type === 'AD') compMultiplier = 1.5;
      score *= compMultiplier;
    }

    // --- [STEP 2] Synergy Bonus ---
    let synergyBonus = 1.0;
    const hypotheticalTeam = [...currentTeamNames, champ.name];
    SYNERGIES.forEach(syn => {
      const involvesChamp = syn.champions.includes(champ.name);
      const isCompleted   = syn.champions.every(c => hypotheticalTeam.includes(c));
      if (involvesChamp && isCompleted) {
        synergyBonus *= (syn.multiplier * 1.05);
      } else if (involvesChamp) {
        const partners = syn.champions.filter(c => c !== champ.name);
        if (partners.every(p => availableNames.has(p))) synergyBonus *= 1.03;
      }
    });
    const synergyImpact = synergyBonus - 1.0;
    score *= (1.0 + synergyImpact * pw.synergy);

    // --- [STEP 3] Counter Logic ---
    let counterBonus = 1.0;
    enemyTeamPicks.forEach(enemy => {
      if (champ.counters && champ.counters.includes(enemy.name)) counterBonus *= 0.85;
      if (enemy.counters && enemy.counters.includes(champ.name)) counterBonus *= 1.15;
    });
    const counterImpact = counterBonus - 1.0;
    score *= (1.0 + counterImpact * pw.counter);

    return { ...champ, mastery: effectiveMastery, score, isKnown };
  });

  scoredChamps.sort((a, b) => b.score - a.score);
  const top3 = scoredChamps.slice(0, 3);
  if (top3.length === 0) return null;

  const totalScore = top3.reduce((sum, c) => sum + c.score, 0);
  let r = Math.random() * totalScore;
  for (const champ of top3) {
    if (r < champ.score) return champ;
    r -= champ.score;
  }
  return top3[0];
}

const BAN_PHASE_WEIGHTS = {
  1: { mastery: 1.25, tier: 1.3, synergy_denial: 0.5,  counter_denial: 0.5  },
  2: { mastery: 1.00, tier: 1.2, synergy_denial: 1.5,  counter_denial: 1.5  },
};

const getBanPhase = (order) => order <= 6 ? 1 : 2;

export function selectBanFromProbabilities(opponentTeam, availableChampions, targetRoles, opponentPicks = [], myTeamPicks = [], banOrder = 1) {
  const phase = getBanPhase(banOrder);
  const bw    = BAN_PHASE_WEIGHTS[phase];

  // [FIX] Validate available champions before filtering
  const validChampions = validateChampionList(availableChampions);

  let candidates = [];

  const targetPlayers   = opponentTeam.roster.filter(p => targetRoles.includes(p.포지션));
  const opponentPickNames = opponentPicks.map(c => c.name);
  const myTeamPickNames   = myTeamPicks.map(c => c.name);

  targetPlayers.forEach(player => {
    const playerData = MASTERY_MAP[player.이름];
    const knownPool  = getKnownPool(playerData);
    const roleChamps = validChampions.filter(c => c.role === player.포지션);

    const knownRoleChamps   = roleChamps.filter(c => knownPool.has(c.name));
    const unknownRoleChamps = roleChamps.filter(c => !knownPool.has(c.name));

    const banPool = knownRoleChamps.length > 0
      ? knownRoleChamps
      : unknownRoleChamps.filter(c => c.tier <= 2).slice(0, 5);

    const scored = banPool.map(c => {
      const isKnown = knownPool.has(c.name);
      const mastery = findMastery(playerData, c.name);
      let banScore  = calculateChampionScore(player, c, isKnown ? mastery : null, isKnown ? 1.0 : 0.3);
      banScore *= bw.mastery;

      // [FIX] Use current tier from the validated champion list
      const tierChamp = validChampions.find(ch => ch.name === c.name);
      const currentTier = tierChamp?.tier; // Only use the current tier from the list
      
      let tierWeight = 1.0;
      switch (currentTier) {  // Use currentTier
        case 1: tierWeight = 1.25; break;
        case 2: tierWeight = 1.1; break;
        case 3: tierWeight = 1.00; break;
        case 4: tierWeight = 0.90; break;
        case 5: tierWeight = 0.75; break;
      }
      const tierImpact = tierWeight - 1.0;
      banScore *= (1.0 + tierImpact * bw.tier);

      let synergyMultiplier = 1.0;
      SYNERGIES.forEach(syn => {
        if (syn.champions.includes(c.name)) {
          const partners = syn.champions.filter(n => n !== c.name);
          if (partners.every(p => opponentPickNames.includes(p))) synergyMultiplier *= 1.5;
        }
      });
      const synDenialImpact = synergyMultiplier - 1.0;
      banScore *= (1.0 + synDenialImpact * bw.synergy_denial);

      let counterMultiplier = 1.0;
      myTeamPickNames.forEach(myPickName => {
        if (c.counters && c.counters.includes(myPickName)) counterMultiplier *= 1.2;
      });
      const counterDenialImpact = counterMultiplier - 1.0;
      banScore *= (1.0 + counterDenialImpact * bw.counter_denial);

      return { champ: c, score: banScore, player };
    });

    scored.sort((a, b) => b.score - a.score);
    candidates.push(...scored.slice(0, 3));
  });

  if (candidates.length === 0) return null;

  const totalChampScore = candidates.reduce((acc, c) => acc + c.score, 0);
  const totalTeamOvr    = opponentTeam.roster.reduce((acc, p) => acc + p.종합, 0);

  const weightedCandidates = candidates.map(item => {
    const champRatio  = item.score / totalChampScore;
    const playerRatio = item.player.종합 / totalTeamOvr;
    return { ...item, weight: champRatio + playerRatio };
  });

  const totalWeight = weightedCandidates.reduce((acc, c) => acc + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of weightedCandidates) {
    if (r < item.weight) return item.champ;
    r -= item.weight;
  }
  return weightedCandidates[0].champ;
}

export function runDraftSimulation(blueTeam, redTeam, fearlessBans, currentChampionList) {
  // [CRITICAL FIX] Don't just validate—ensure we're using FRESH tier data from the current list
  // The champion list passed in should already have the current patch's tiers
  // If it's empty, that's a real error (not a validation issue)
  
  if (!Array.isArray(currentChampionList) || currentChampionList.length === 0) {
    console.error('Draft simulation failed: champion list is empty or null');
    return {
      picks: { A: [], B: [] },
      bans: { A: [], B: [] },
      draftLogs: ['Error: No champions available'],
      fearlessBans: Array.isArray(fearlessBans) ? [...fearlessBans] : [],
      usedChamps: []
    };
  }

  // Use the list AS-IS (it should already be the correct meta version from Dashboard)
  const champList = currentChampionList;

  let localBans = new Set([...fearlessBans]);
  let picks     = { BLUE: {}, RED: {} };
  let logs      = [];
  let blueBans  = [];
  let redBans   = [];
  let remainingRoles = {
    BLUE: ['TOP', 'JGL', 'MID', 'ADC', 'SUP'],
    RED:  ['TOP', 'JGL', 'MID', 'ADC', 'SUP']
  };

  DRAFT_SEQUENCE.forEach(step => {
    const actingTeam   = step.side === 'BLUE' ? blueTeam  : redTeam;
    const opponentTeam = step.side === 'BLUE' ? redTeam   : blueTeam;
    const mySide       = step.side;
    const opponentSide = step.side === 'BLUE' ? 'RED' : 'BLUE';
    
    // Filter from the CURRENT champion list (which should have current patch tiers)
    const availableChamps = champList.filter(c => !localBans.has(c.name));

    const currentMySidePicks = Object.values(picks[mySide]);
    const currentEnemyPicks  = Object.values(picks[opponentSide]);

    if (step.type === 'BAN') {
      const banCandidate = selectBanFromProbabilities(
        opponentTeam,
        availableChamps,
        remainingRoles[opponentSide],
        currentEnemyPicks,
        currentMySidePicks,
        step.order
      );
      if (banCandidate) {
        localBans.add(banCandidate.name);
        if (step.side === 'BLUE') blueBans.push(banCandidate.name);
        else redBans.push(banCandidate.name);
        logs.push(`[${step.order}] ${step.label}: 🚫 ${banCandidate.name}`);
      } else {
        logs.push(`[${step.order}] ${step.label}: (없음)`);
      }
    } else {
      let roleCandidates = [];

      remainingRoles[mySide].forEach(role => {
        const player = actingTeam.roster.find(p => p.포지션 === role);
        if (player) {
          const candidateChamp = selectPickFromTop3(
            player,
            availableChamps,
            currentMySidePicks,
            currentEnemyPicks,
            step.order,
            fearlessBans
          );
          if (candidateChamp) {
            roleCandidates.push({ role, champ: candidateChamp, score: candidateChamp.score });
          }
        }
      });

      roleCandidates.sort((a, b) => b.score - a.score);
      const selected = roleCandidates[0];

      if (selected) {
        const { champ: bestPick, role: bestPickRole } = selected;
        localBans.add(bestPick.name);
        picks[mySide][bestPickRole] = bestPick;
        remainingRoles[mySide] = remainingRoles[mySide].filter(r => r !== bestPickRole);
        const playerObj = actingTeam.roster.find(p => p.포지션 === bestPickRole);
        const pName     = playerObj ? playerObj.이름 : 'Unknown';
        logs.push(`[${step.order}] ${step.label}: ✅ ${bestPick.name} (${pName})`);
      } else {
        logs.push(`[${step.order}] ${step.label}: (랜덤 픽)`);
      }
    }
  });

  const mapPicks = (side, teamRoster) =>
    ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(pos => {
      const c = picks[side][pos];
      if (!c) return null;
      const p = teamRoster.find(pl => pl.포지션 === pos);
      
      // [FIX] Always look up the tier from the CURRENT champion list
      const currentTier = champList.find(ch => ch.name === c.name)?.tier;
      
      return {
          champName:  c.name,
          tier:       currentTier,  
          mastery:    c.mastery,
          playerName: p ? p.이름 : 'Unknown Player',
          playerOvr:  p ? p.종합 : 70
      };
    }).filter(Boolean);

  return {
    picks:       { A: mapPicks('BLUE', blueTeam.roster), B: mapPicks('RED', redTeam.roster) },
    bans:        { A: blueBans, B: redBans },
    draftLogs:   logs,
    fearlessBans: Array.isArray(fearlessBans) ? [...fearlessBans] : (fearlessBans ? [fearlessBans] : []),
    usedChamps:  [...Object.values(picks.BLUE), ...Object.values(picks.RED)].map(c => c.name)
  };
}