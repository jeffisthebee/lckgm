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
import tt from './player_mastertt.json'
import al from './player_masteryal.json'
import blg from './player_masteryblg.json'
import c9 from './player_masteryc9.json'
import cfo from './player_masteryc9.json'
import dfm from './player_masterydfm.json'
import dig from './player_masterydig.json'
import dsg from './player_masterydsg.json'
import edg from './player_masteryedg.json'
import fly from './player_masteryfly.json'
import fnc from './player_masteryfnc.json'
import fur from './player_masteryfur.json'
import fx from './player_masteryfx.json'
import g2 from './player_masteryg2.json'
import gam from './player_masterygam.json'
import gx from './player_masterygx.json'
import gz from './player_masterygz.json'
import ig from './player_masteryig.json'
import jdg from './player_masteryjdg.json'
import kc from './player_masterykc.json'
import kcb from './player_masterykcb.json'
import lev from './player_masterylev.json'
import lgd from './player_masterylgd.json'
import lng from './player_masterylng.json'
import los from './player_masterylos.json'
import loud from './player_masteryloud.json'
import lr from './player_masterylr.json'
import lyon from './player_masterylyon.json'
import mkoi from './player_masterymkoi.json'
import mvk from './player_masterymvk.json'
import navi from './player_masterynavi.json'
import nip from './player_masterynip.json'
import omg from './player_masteryomg.json'
import pain from './player_masterypain.json'
import red from './player_masteryred.json'
import sens from './player_masterysens.json'
import shft from './player_masteryshft.json'
import shg from './player_masteryshg.json'
import sk from './player_masterysk.json'
import sr from './player_masterysr.json'
import tes from './player_masterytes.json'
import th from './player_masteryth.json'
import tl from './player_masterytl.json'
import tsw from './player_masterytsw.json'
import up from './player_masteryup.json'
import vit from './player_masteryvit.json'
import vks from './player_masteryvks.json'
import wbg from './player_masterywbg.json'
import we from './player_masterywe.json'

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
  ...dns,
  ...tt,
  ...al,
  ...blg, 
  ...c9,
  ...cfo,
  ...dfm,
  ...dig,
  ...dsg,
  ...edg,
  ...fly,
  ...fnc,
  ...fur,
  ...fx,
  ...g2,
  ...gam,
  ...gx,
  ...gz,
  ...ig,
  ...jdg,
  ...kc,
  ...kcb,
  ...lev,
  ...lgd,
  ...lng,
  ...los,
  ...loud,
  ...lr,
  ...lyon,
  ...mkoi,
  ...mvk,
  ...navi,
  ...nip,
  ...omg,
  ...pain,
  ...red,
  ...sens,
  ...shft,
  ...shg,
  ...sk,
  ...sr,
  ...tes,
  ...th,
  ...tl,
  ...tsw,
  ...up,
  ...vit,
  ...vks,
  ...wbg,
  ...we
  
];

// 3. 외부에서 쓸 수 있게 내보냅니다.
export default allMastery;