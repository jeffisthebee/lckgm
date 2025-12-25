// 1. 각 팀의 JSON 파일들을 import 합니다.
import t1 from './player_masteryt1.json';
import geng from './player_masterygeng.json';
import hle from './player_masteryhle.json';
import kt from './player_masterykt.json';
import dk from './player_masterydk.json';
import bnk from './player_masterybnk.json';
import ns from './player_masteryns.json';
import bro from './player_masterybro.json';
import drx from './player_masterydrx.json';
import dns from './player_masterydns.json';

// 2. 모든 데이터를 하나의 배열로 합칩니다.
const allMastery = [
  ...t1,
  ...geng,
  ...hle,
  ...kt,
  ...dk,
  ...bnk,
  ...ns,
  ...bro,
  ...drx,
  ...dns
];

// 3. 외부에서 쓸 수 있게 내보냅니다.
export default allMastery;