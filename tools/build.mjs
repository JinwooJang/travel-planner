// Builds projected base-map + route data for the Oman road-trip artifact.
import fs from "node:fs";
import { createRequire } from "node:module";
const here = p => new URL(p, import.meta.url);
const require = createRequire(import.meta.url);
import { feature, mesh } from "topojson-client";
import { presimplify, simplify } from "topojson-simplify";
import { geoMercator, geoPath, geoBounds } from "d3-geo";
import { buildGraph, route as gRoute, CLS } from "./roadgraph.mjs";

const topo0 = JSON.parse(fs.readFileSync(require.resolve("world-atlas/countries-10m.json"), "utf8"));
const topo = simplify(presimplify(topo0), 0);

const W = 1000, H = 1000;
const LON0 = 44.0, LON1 = 68.0, LAT0 = 10.0, LAT1 = 31.0;
const frame = { type: "Polygon", coordinates: [[[LON0, LAT0], [LON0, LAT1], [LON1, LAT1], [LON1, LAT0], [LON0, LAT0]]] };
const proj = geoMercator().fitSize([W, H], frame).clipExtent([[-5, -5], [W + 5, H + 5]]);
const path = geoPath(proj).digits(1);
const P = ([lng, lat]) => proj([lng, lat]).map(v => Math.round(v * 10) / 10);

const NAMES = { "512": "오만", "784": "아랍에미리트", "682": "사우디아라비아", "887": "예멘", "364": "이란", "634": "카타르", "048": "바레인", "586": "파키스탄" };
// only countries whose bounds overlap the frame (antimeridian-crossing shapes would fill the whole clip box)
const geoms = topo.objects.countries.geometries.filter(g => {
  const [[w, sth], [e, nth]] = geoBounds(feature(topo, g));
  return w <= e && e - w < 180 && e >= LON0 && w <= LON1 && nth >= LAT0 && sth <= LAT1;
});
const countries = geoms.map(g => ({ id: g.id, d: path(feature(topo, g)) })).filter(c => c.d);
const sub = { ...topo.objects.countries, geometries: geoms };
const borders = path(mesh(topo, sub, (a, b) => a !== b));

// ---- itinerary -----------------------------------------------------------
// kind: visit | border | via ; opt: optional stop (not on the route line)
const S = {
  dubai:   { ko: "두바이", en: "Dubai", ll: [55.2708, 25.2048], kind: "city", q: "Dubai, UAE" },
  hatta:   { ko: "하타 국경", en: "Hatta Border Crossing", ll: [56.2012, 24.8065], kind: "border", pid: "ChIJMRTHpdcf9T4RirKe8-GUT90", note: "UAE 출국세 1인 AED 35 · 오만 커버 보험(오렌지카드) 확인 · 외국인은 알 마담–하타 직행(E44)이 막혀 있다는 안내가 있으니 내비가 그 길로 가면 샤르자–칼바 도로로 우회" },
  mutrah:  { ko: "무트라 수크·코니시", en: "Mutrah Souq", ll: [58.5645, 23.6204], kind: "visit", pid: "ChIJL7iog4X3kT4RwF2LPI3S6hQ", note: "해 질 무렵 코니시 산책 · 수크 금요일은 16시 이후" },
  mosque:  { ko: "술탄 카부스 그랜드 모스크", en: "Sultan Qaboos Grand Mosque", ll: [58.3887, 23.5838], kind: "visit", pid: "ChIJLbC42cX_kT4R2eXXgD5ful8", note: "관광객 08:00–11:00 · 긴 옷, 여성은 스카프" },
  bimmah:  { ko: "비마 싱크홀", en: "Bimmah Sinkhole", ll: [59.0718, 23.0362], kind: "visit", pid: "ChIJOYp4ZqZVkD4RHaMFyjWyj-A", note: "무료 · 30~40분이면 충분" },
  shab:    { ko: "와디 샵", en: "Wadi Shab", ll: [59.1773, 22.8128], kind: "visit", pid: "ChIJqzab6Z31kD4RZq8Nem5HfVc", note: "보트로 건너 하이킹+수영 2~3시간 · 아쿠아슈즈 · 보트 18시 마감" },
  jinz:    { ko: "라스 알 진즈 거북 보호구역", en: "Ras Al Jinz Turtle Reserve", ll: [59.8273, 22.4256], kind: "visit", pid: "ChIJUQDMRIgCmj4RkWYfRAmBU3A", note: "밤 20:30 거북 투어 · 수르 이후 어두우니 해 지기 전 도착" },
  wbk:     { ko: "와디 바니 칼리드", en: "Wadi Bani Khalid Pools", ll: [59.0939, 22.6157], kind: "visit", pid: "ChIJNx5kTUgjkD4Ri4JZqawSu6Y", note: "구명조끼 대여 · 주차장에서 걸어서 약 15분 · 주변 공사 중" },
  camp:    { ko: "와히바 사막 캠프", en: "Starry Domes Desert Camp (예시)", ll: [58.7819, 22.2803], kind: "visit", pid: "ChIJ_ZvpZ7afmj4RU5LAjY_UivQ", note: "비디야 마을에서 픽업·호송 · 일몰과 별 보기" },
  nizwa:   { ko: "니즈와 요새·수크", en: "Nizwa Fort", ll: [57.5302, 22.9332], kind: "visit", pid: "ChIJPQ3xm-rwjj4Rq6oCMx2_1h8", note: "요새 08:00–20:00 · 금요일 아침 가축시장" },
  diana:   { ko: "다이애나 뷰포인트", en: "Diana's Viewpoint", ll: [57.6686, 23.0669], kind: "visit", opt: true, pid: "ChIJQXUNkv5fjj4RkGcYZr96P-M", note: "선택 · 산 입구 검문소는 4WD만 통과 · 일몰 추천" },
  adam:    { ko: "아담", en: "Adam", ll: [57.53, 22.38], kind: "via", q: "Adam, Oman", note: "Route 31 시작 · 주유" },
  haima:   { ko: "하이마", en: "Haima", ll: [56.276, 19.959], kind: "via", q: "Haima, Oman", note: "중간 휴식 · 주유 · 이후 주유소 간격이 넓은 구간 있음" },
  thumrait:{ ko: "툼라이트", en: "Thumrait", ll: [54.027, 17.666], kind: "via", q: "Thumrait, Oman", note: "산을 넘으면 샬랄라" },
  salalah: { ko: "샬랄라", en: "Salalah", ll: [54.0924, 17.0151], kind: "city", q: "Salalah, Oman" },
  baleed:  { ko: "발리드 유적공원·유향박물관", en: "Museum of the Frankincense Land", ll: [54.1361, 17.0094], kind: "visit", pid: "ChIJz0b5UnRg0T0R8X6VVCFDsOw", note: "09:00–19:00 · 금·토는 15시부터 · 유적 골프카트 1리알" },
  rori:    { ko: "코르 로리 (수뭄람 유적)", en: "Khor Rori", ll: [54.4347, 17.0394], kind: "visit", pid: "ChIJhYXz12G_0z0RSZEx7mPmjOw", note: "08:00–18:30 · 금·토는 15시부터 · 입장료 카드 결제" },
  darbat:  { ko: "와디 다르바트", en: "Wadi Darbat", ll: [54.4358, 17.0760], kind: "visit", pid: "ChIJTTRgcoe_0z0RB2x15olUXc0", note: "10월엔 폭포보다 호수·풍경 위주 · 보트 대여" },
  mirbat:  { ko: "미르바트 성", en: "Mirbat Castle", ll: [54.6916, 16.9925], kind: "visit", pid: "ChIJJ3U3ivyl0z0RTMysGvqThhc", note: "09:00–16:00 · 금요일은 오전·오후 나눠 운영" },
  samhan:  { ko: "제벨 삼한 전망대", en: "Jabal Samhan Viewpoint", ll: [54.6981, 17.1026], kind: "visit", pid: "ChIJQTlVOVWh0z0Ryfifa7-Qi50", note: "절벽 전망 · 화장실·매점 없음" },
  marneef: { ko: "마르니프 동굴·분수공", en: "Marneef Cave and Blow Holes", ll: [53.7659, 16.8750], kind: "visit", pid: "ChIJwVxOkJts0T0RbzuZIEZ7hZc", note: "무그사일 해변 끝 · 주차장에서 1km, 골프카트 있음 · 안전선 안쪽에서만" },
  fazayah: { ko: "파자야 해변", en: "Fazayah Beach", ll: [53.7214, 16.8405], kind: "visit", pid: "ChIJ3XC3vCQT0T0RfF5l6IcG478", note: "가파른 비포장길 · 4WD 권장 · 물·간식 챙기기" },
  haffa:   { ko: "알 하파 유향시장", en: "Frankincense Market - Al-Hafa", ll: [54.1081, 17.0008], kind: "visit", pid: "ChIJfTK7IOzf0z0RMZQpVm9UEeA", note: "17:00–24:00" },
  bahla:   { ko: "바흘라 요새", en: "Bahla Fort", ll: [57.3002, 22.9644], kind: "visit", pid: "ChIJB94JPWvqjj4RbV2dzqtn-AA", note: "유네스코 세계유산 · 그늘 적으니 오전에" },
  jabreen: { ko: "자브린 성", en: "Jabreen Castle", ll: [57.2493, 22.9153], kind: "visit", pid: "ChIJdTPmLzrCjj4RIsfL5fNZxCw", note: "채색 천장 · 07:30–21:00", side: "l" },
  mezyad:  { ko: "메지아드 국경", en: "Mezyad Border Post", ll: [55.8463, 24.0232], kind: "border", pid: "ChIJwTL19QfAij4ReUIBb-zRIZE", note: "알아인 남쪽 국경 · 통과 40~60분 정도 · 출국 시 AED 35" },
  nizwaC:  { ko: "니즈와", en: "Nizwa", ll: [57.5333, 22.9333], kind: "city", q: "Nizwa, Oman" },
  mctAir:  { ko: "무스카트 공항", en: "Muscat International Airport", ll: [58.2827, 23.6006], kind: "air", pid: "ChIJR5CSsAP-jT4RF9l9K0nK5yo", note: "차는 공항 주차장(P1·P2)에 이틀 · 출발 1시간 반 전 도착 · 샬랄라까지 약 1시간 30~45분" },
  sllAir:  { ko: "샬랄라 공항", en: "Salalah International Airport", ll: [54.0881, 17.0472], kind: "air", pid: "ChIJiVdQzdPf0z0RNICTUqRKxq8", note: "도착장에서 렌터카 픽업 · 시내까지 약 10분 · 파자야까지 가려면 4WD로", side: "l" },
};

// road-shape helper points (not stops) so the line roughly follows the highways
const R = {
  madam: [55.786, 24.968], wajajah: [56.228, 24.797], wjz: [56.50, 24.55], sohar: [56.72, 24.35], saham: [56.89, 24.17],
  khaburah: [57.10, 23.97], suwaiq: [57.44, 23.85], barka: [57.89, 23.68], seeb: [58.19, 23.67], qurum: [58.46, 23.60],
  amerat: [58.49, 23.52], wadiad: [58.70, 23.40], quriyat: [58.91, 23.26], tiwi: [59.24, 22.80], sur: [59.528, 22.566],
  hadd: [59.79, 22.53], kamil: [59.20, 22.22], wbkTurn: [59.12, 22.42], bidiyah: [58.80, 22.45], ibra: [58.53, 22.69],
  samad: [58.15, 22.80], izki: [57.77, 22.93], birkat: [57.66, 22.91], taqah: [54.40, 17.04], dahariz: [54.20, 17.02],
  rakhyut: [53.95, 16.95], ibri: [56.515, 23.226], dank: [56.20, 23.55], alain: [55.744, 24.207], dxbRd: [55.55, 24.70],
  samhanRd: [54.62, 17.03], mughRd: [53.83, 16.90], bahlaRd: [57.29, 22.975], izkiJ: [57.42, 22.95], wbkRd: [59.03, 22.47], mctRd: [58.33, 23.595], mudaybi: [58.12, 22.58], sinaw: [58.03, 22.50],
};

const days = [
  { id: "n1", grp: "north", title: "두바이 → 무스카트", stay: "무스카트", dist: "약 450km · 5시간 + 국경",
    tip: "하타 국경으로 들어가 바티나 해안을 따라 내려갑니다. 국경은 주말 오전이 붐벼요.",
    stops: ["dubai", "hatta", "mutrah"],
    line: ["dubai", R.madam, "hatta", R.wajajah, R.wjz, R.sohar, R.saham, R.khaburah, R.suwaiq, R.barka, R.seeb, R.qurum, "mutrah"] },
  { id: "n2", grp: "north", title: "해안도로 따라 동쪽으로", stay: "라스 알 진즈", dist: "약 300km",
    tip: "가장 빡빡한 날. 모스크는 11시에 닫으니 아침 일찍, 와디 샵은 정오 전후 더위를 감안하세요.",
    stops: ["mosque", "bimmah", "shab", "jinz"],
    line: ["mutrah", R.qurum, "mosque", R.amerat, R.wadiad, R.quriyat, "bimmah", "shab", R.tiwi, R.sur, R.hadd, "jinz"] },
  { id: "n3", grp: "north", title: "오아시스와 사막", stay: "와히바 사막 캠프", dist: "약 250km",
    tip: "와디 바니 칼리드는 오전에 수영하고, 오후에 비디야로 넘어가 캠프 차량을 만나세요.",
    stops: ["wbk", "camp"],
    line: ["jinz", R.hadd, R.sur, R.kamil, R.wbkTurn, "wbk", R.bidiyah, "camp"] },
  { id: "n4", grp: "north", title: "사막 → 니즈와", stay: "니즈와", dist: "약 220km",
    tip: "니즈와에서 하루 마무리. 4WD면 오후에 제벨 아크다르(다이애나 뷰포인트)를 왕복하세요.",
    stops: ["nizwa", "diana"],
    line: ["camp", R.bidiyah, R.ibra, R.samad, R.izki, "nizwa"],
    spur: [R.birkat, "diana"] },
  { id: "dn", grp: "north", title: "두바이 → 니즈와", stay: "니즈와", dist: "약 420km · 4.5~5시간 + 국경",
    tip: "알아인 남쪽 메지아드 국경으로 들어가 이브리를 거쳐 니즈와까지. 오후에 니즈와 요새와 수크를 둘러보세요. 요새는 20시까지 열어요.",
    stops: ["dubai", "mezyad", "nizwa"],
    line: ["dubai", R.dxbRd, R.alain, "mezyad", R.dank, R.ibri, R.bahlaRd, R.izkiJ, "nizwa"] },
  { id: "s1", grp: "desert", title: "Route 31 사막도로로 샬랄라", stay: "샬랄라", dist: "약 780km · 8~9시간",
    tip: "운전만 하는 날. 아침 일찍 출발하고, 하이마 이후엔 주유소가 보이면 채우세요. 오만 리알 현금 필수.",
    stops: ["adam", "haima", "thumrait", "salalah"],
    line: ["nizwaC", "adam", "haima", "thumrait", "salalah"] },
  { id: "s2", grp: "dhofar", title: "샬랄라 동부", stay: "샬랄라", dist: "약 200km",
    tip: "금·토요일엔 박물관과 코르 로리가 15시에 열어요. 그날이면 순서를 뒤집어 미르바트부터 도세요.",
    stops: ["baleed", "rori", "darbat", "mirbat", "samhan"],
    line: ["salalah", "baleed", R.dahariz, R.taqah, "rori", "darbat", "rori", "mirbat", R.samhanRd, "samhan", R.samhanRd, R.taqah, R.dahariz, "salalah"] },
  { id: "s3", grp: "dhofar", title: "샬랄라 서부", stay: "샬랄라", dist: "약 130km",
    tip: "분수공은 파도가 셀수록 볼만해요. 파자야에서 수영하고 저녁엔 유향시장으로.",
    stops: ["marneef", "fazayah", "haffa"],
    line: ["salalah", R.rakhyut, R.mughRd, "marneef", "fazayah", "marneef", R.mughRd, R.rakhyut, "haffa"] },
  { id: "s4", grp: "desert", title: "다시 북쪽으로", stay: "니즈와 (또는 바흘라)", dist: "약 800km · 8~9시간",
    tip: "내려올 때의 역방향. 해 지기 전에 니즈와 도착을 목표로 아침 일찍 출발하세요.",
    stops: ["thumrait", "haima", "adam", "nizwaC"],
    line: ["salalah", "thumrait", "haima", "adam", "nizwaC"] },
  { id: "rt", grp: "north", title: "요새 두 곳 보고 두바이로", stay: "두바이 도착", dist: "약 400km · 5시간 + 국경",
    tip: "바흘라 요새는 그늘이 적어 오전 관람을 추천해요. 이후 이브리를 지나 메지아드 국경으로.",
    stops: ["bahla", "jabreen", "mezyad", "dubai"],
    line: ["nizwaC", "bahla", "jabreen", "bahla", R.ibri, R.dank, "mezyad", R.alain, R.dxbRd, "dubai"] },
  { id: "dj", grp: "north", title: "두바이 → 요새 두 곳 → 니즈와", stay: "니즈와", dist: "약 430km · 5시간 + 국경",
    tip: "메지아드 국경으로 들어가 이브리를 지나요. 오후에 자브린 성(21시까지)과 바흘라 요새(19시까지)를 보고 니즈와에서 묵어요.",
    stops: ["dubai", "mezyad", "jabreen", "bahla", "nizwaC"],
    line: ["dubai", R.dxbRd, R.alain, "mezyad", R.dank, R.ibri, "jabreen", "bahla", R.izkiJ, "nizwaC"] },
  { id: "nw", grp: "north", title: "니즈와 → 오아시스 → 사막", stay: "와히바 사막 캠프", dist: "약 320km",
    tip: "아침 8시에 니즈와 요새와 수크를 보고 동쪽으로. 와디 바니 칼리드에서 수영한 뒤 비디야에서 캠프 차량을 만나 사막 일몰을 봐요.",
    stops: ["nizwa", "wbk", "camp"],
    line: ["nizwa", R.izki, R.samad, R.ibra, R.bidiyah, R.wbkRd, "wbk", R.wbkRd, R.bidiyah, "camp"] },
  { id: "cs", grp: "north", title: "사막 → 와디 샵 → 무스카트", stay: "무스카트", dist: "약 360km",
    tip: "캠프에서 일찍 나와 수르를 거쳐 와디 샵으로. 보트가 18시에 끊기고 한낮이 더우니 오전에 들어가세요. 저녁엔 무트라 코니시 산책.",
    stops: ["shab", "bimmah", "mutrah"],
    line: ["camp", R.bidiyah, R.wbkRd, R.kamil, R.sur, R.tiwi, "shab", "bimmah", R.quriyat, R.wadiad, R.amerat, R.qurum, "mutrah"] },
  { id: "f1", grp: "dhofar", title: "모스크 보고 샬랄라로 비행", stay: "샬랄라", dist: "약 50km + 비행 1시간 40분",
    tip: "그랜드 모스크(08~11시)를 보고 공항에 차를 세운 뒤 정오 무렵 비행기로 샬랄라에. 공항에서 렌터카를 받아 유향박물관(19시까지)과 저녁 유향시장으로.",
    stops: ["mosque", "mctAir", "sllAir", "baleed", "haffa"],
    line: ["mutrah", R.qurum, "mosque", R.mctRd, "mctAir"],
    line2: ["sllAir", "baleed", "haffa"],
    fly: ["mctAir", "sllAir"] },
  { id: "sa", grp: "dhofar", title: "샬랄라 동부와 서부", stay: "샬랄라", dist: "약 300km",
    tip: "오전엔 동부(다르바트·코르 로리·미르바트·삼한), 오후엔 서부(무그사일 분수공·파자야). 금·토요일엔 코르 로리가 15시에 열리니 서부를 먼저 도세요.",
    stops: ["darbat", "rori", "mirbat", "samhan", "marneef", "fazayah"],
    line: ["salalah", R.dahariz, R.taqah, "darbat", "rori", "mirbat", R.samhanRd, "samhan", R.samhanRd, R.taqah, R.dahariz, "salalah", R.rakhyut, R.mughRd, "marneef", "fazayah", "salalah"] },
  { id: "f2", grp: "north", title: "무스카트로 비행 → 두바이", stay: "두바이 도착", dist: "비행 + 약 430km · 운전 5시간 + 국경",
    tip: "오전 비행기로 무스카트에 돌아와 공항에서 차를 찾고, 바티나 해안을 따라 하타 국경으로. 주말 저녁엔 국경이 붐벼요.",
    stops: ["sllAir", "mctAir", "hatta", "dubai"],
    line: ["salalah", "sllAir"],
    line2: ["mctAir", R.barka, R.suwaiq, R.khaburah, R.saham, R.sohar, R.wjz, R.wajajah, "hatta", R.madam, "dubai"],
    fly: ["sllAir", "mctAir"] },
  { id: "cn", grp: "north", title: "모스크·와디 샵 → 니즈와", stay: "니즈와", dist: "",
    tip: "가장 빡빡한 날. 그랜드 모스크는 8시 개장에 맞춰 1시간만, 와디 샵은 정오 전후 3시간 남짓. 와디 샵에서 무스카트 쪽으로 되돌아가 니즈와로 가요.",
    stops: ["mosque", "bimmah", "shab", "nizwaC"],
    line: ["mutrah", "mosque", "bimmah", "shab", "nizwaC"] },
  { id: "sb", grp: "dhofar", title: "샬랄라 하루에 몰아 보기", stay: "샬랄라", dist: "약 280km",
    tip: "오전엔 동부(다르바트·코르 로리·미르바트·삼한), 점심 뒤 발리드 유적·유향박물관, 해 질 무렵 무그사일 분수공. 금·토요일엔 코르 로리와 박물관이 15시에 열리니 오전에 무그사일·다르바트·미르바트를 먼저 도세요.",
    stops: ["darbat", "rori", "mirbat", "samhan", "baleed", "marneef"],
    line: ["salalah", R.dahariz, R.taqah, "darbat", "rori", "mirbat", R.samhanRd, "samhan", R.samhanRd, R.taqah, R.dahariz, "baleed", "salalah", R.rakhyut, R.mughRd, "marneef", "salalah"] },
  { id: "rt2", grp: "north", title: "요새 세 곳 보고 두바이로", stay: "두바이 도착", dist: "약 430km · 5시간 + 국경",
    tip: "니즈와 요새(08시 개장)를 1시간쯤 보고 바흘라 요새, 자브린 성을 거쳐 이브리·메지아드 국경으로. 두바이 도착은 17시 전후예요.",
    stops: ["nizwa", "bahla", "jabreen", "mezyad", "dubai"],
    line: ["nizwa", "bahla", "jabreen", "bahla", R.ibri, R.dank, "mezyad", R.alain, R.dxbRd, "dubai"] },
];

const courses = [
  { id: "c6c", label: "6일 · 차로만", name: "6일 북부+샬랄라 (차로만)", def: true,
    days: ["n1", "cn", "s1", "sb", "s4", "rt2"],
    border: "하타 입국 · 메지아드 귀국",
    lead: "비행 없이 무스카트·와디 샵·니즈와와 샬랄라를 모두 차로 도는 일정이에요. 니즈와↔샬랄라가 편도 약 900km라 9시간 넘게 운전하는 날이 이틀(3일차·5일차) 생겨요. 운전할 사람이 둘이면 교대하세요.",
    alt: "와히바 사막 캠프는 넣지 못했어요. 사막에서 샬랄라까지는 하루에 1,100km가 넘어요. 빠지는 곳은 와히바 사막, 와디 바니 칼리드, 라스 알 진즈 거북 투어, 제벨 아크다르, 파자야 해변이에요." },
  { id: "c6n", label: "6일 · 비행 연계", name: "6일 북부+샬랄라 (비행 연계)",
    days: ["dj", "nw", "cs", "f1", "sa", "f2"],
    border: "메지아드 입국 · 하타 귀국", extra: [["비행", "무스카트 ↔ 샬랄라 왕복"]],
    lead: "니즈와↔샬랄라를 차로 왕복하면 이틀 동안 약 1,800km를 운전해야 해서, 그 구간을 무스카트↔샬랄라 왕복 비행으로 바꾼 일정이에요. 차는 무스카트 공항에 이틀 세워 두고, 샬랄라에선 공항에서 렌터카를 빌려요. 하루 운전은 최대 430km 정도예요.",
    alt: "빠지는 곳은 라스 알 진즈 거북 투어(10월 중순이면 시즌 끝무렵)와 제벨 아크다르예요. 비행 없이 차로만 가면 이 구간에서만 9시간 넘게 운전하는 날이 이틀 생겨요." },
  { id: "c9", label: "9일 전체", name: "9일 전체 경로", days: ["n1", "n2", "n3", "n4", "s1", "s2", "s3", "s4", "rt"],
    border: "하타 입국 · 메지아드 귀국",
    lead: "하타 국경으로 들어가 동쪽 해안과 사막을 돌고, 니즈와에서 Route 31로 샬랄라까지 내려갔다가 메지아드 국경으로 돌아오는 순환 경로예요." },
  { id: "c6", label: "6일 · 샬랄라 집중", name: "6일 샬랄라 집중 코스", days: ["dn", "s1", "s2", "s3", "s4", "rt"],
    border: "메지아드 왕복",
    lead: "해안과 사막을 빼고 샬랄라에 집중한 일정이에요. 메지아드 국경으로 들어가 니즈와에서 하루 묵고, Route 31로 내려가 샬랄라에서 이틀을 보낸 뒤 같은 길로 돌아와요. 운전만 하는 날이 이틀이라 그날은 아침 일찍 출발하는 게 핵심이에요.",
    alt: "무스카트를 넣고 싶으면 마지막 날을 니즈와 → 그랜드 모스크 → 하타 국경 → 두바이로 바꿀 수 있어요. 약 600km로 길어져요." },
  { id: "c5", label: "5일 · 북부", name: "5일 북부 코스", days: ["n1", "n2", "n3", "n4", "rt"],
    border: "하타 입국 · 메지아드 귀국",
    lead: "샬랄라를 빼고 북부 해안·사막·니즈와를 도는 처음 짠 5일 일정이에요. 4일차 숙박을 제벨 아크다르로 잡으면 원래 안과 같아요." },
];


// ---- timing: default minutes spent at each stop, opening hours ("HH:MM"), Fri/Sat variants (dow 5/6) ----
const STOPMETA = {
  hatta: { dw: 60 }, mezyad: { dw: 60 },
  mutrah: { dw: 90, hrs: ["09:00", "23:00"], dow: { 5: ["16:00", "22:00"] } },
  mosque: { dw: 60, hrs: ["08:00", "11:00"] },
  bimmah: { dw: 40, hrs: ["08:00", "20:00"] },
  shab: { dw: 180, hrs: ["07:00", "15:00"], late: "15시 넘어 들어가면 빠듯해요 (보트 18시 마감)" },
  jinz: { dw: 0, hrs: [null, "20:25"], late: "20:30 거북 투어 시작 전에 도착해야 해요" },
  wbk: { dw: 120, hrs: ["09:00", "17:00"] },
  camp: { dw: 0, hrs: [null, "17:30"], late: "해 지기 전(17:30 전후)에 도착하는 게 좋아요" },
  nizwa: { dw: 90, hrs: ["08:00", "20:00"] },
  diana: { dw: 60 },
  adam: { dw: 15 }, haima: { dw: 45 }, thumrait: { dw: 15 },
  baleed: { dw: 90, hrs: ["09:00", "19:00"], dow: { 5: ["15:00", "19:00"], 6: ["15:00", "19:00"] } },
  rori: { dw: 45, hrs: ["08:00", "18:30"], dow: { 5: ["15:00", "18:30"], 6: ["15:00", "18:30"] } },
  darbat: { dw: 60 },
  mirbat: { dw: 45, hrs: ["09:00", "16:00"] },
  samhan: { dw: 40 },
  marneef: { dw: 60 },
  fazayah: { dw: 120, hrs: [null, "16:30"], late: "해 지기 전에 나오려면 16시 반 전에는 도착해야 해요" },
  haffa: { dw: 60, hrs: ["17:00", "24:00"] },
  bahla: { dw: 75, hrs: ["08:00", "19:00"] },
  jabreen: { dw: 60, hrs: ["07:30", "21:00"] },
  mctAir: { dw: 90 }, sllAir: { dw: 45 },
};
for (const [k, m] of Object.entries(STOPMETA)) Object.assign(S[k], m);

// per day: default start time, stop-time overrides [minutes, note]
const DAYMETA = {
  n1: { start: "07:00" },
  n2: { start: "07:45", dw: { shab: [210, "점심 포함"] } },
  n3: { start: "08:00", dw: { wbk: [150, "점심 포함"] } },
  n4: { start: "08:30" },
  dn: { start: "07:00" },
  s1: { start: "06:30", dw: { haima: [60, "점심"] } },
  s2: { start: "08:00", dw: { mirbat: [90, "점심 포함"] } },
  s3: { start: "11:00", dw: { fazayah: [180, "점심 포함"] } },
  s4: { start: "06:30", dw: { haima: [60, "점심"] } },
  rt: { start: "08:00", dw: { jabreen: [90, "점심 포함"], mezyad: [45] } },
  dj: { start: "07:00", dw: { jabreen: [90, "점심 포함"] } },
  nw: { start: "08:00", dw: { wbk: [150, "점심 포함"] } },
  cs: { start: "07:00", dw: { shab: [210, "점심 포함"] } },
  f1: { start: "08:30", dw: { mctAir: [90, "탑승 수속"], sllAir: [45, "렌터카 픽업"], baleed: [150, "늦은 점심 포함"] } },
  sa: { start: "08:00", dw: { mirbat: [90, "점심 포함"] } },
  f2: { start: "07:00", dw: { sllAir: [90, "탑승 수속"], mctAir: [30, "주차장에서 차 찾기"] } },
  cn: { start: "07:45", dw: { shab: [200, "점심 포함"] } },
  sb: { start: "07:30", dw: { baleed: [120, "점심 포함"] } },
  rt2: { start: "07:45", dw: { jabreen: [90, "점심 포함"], mezyad: [45] } },
};
const FLIGHT_MIN = 100;

// ---- road graph routing for every day ----
const G = buildGraph(here("roads_box.json"), S);
const legRoute = (a, b) => {
  const r = gRoute(G, G.stopNode[a], G.stopNode[b]);
  if (!r) throw new Error(`no route ${a} → ${b}`);
  return r;
};
const nodeXY = i => P(G.nodes[i]);
const r5 = m => Math.max(5, Math.round(m / 5) * 5);
function routeDay(d) {
  const startKey = d.line[0], endKey = (d.line2 || d.line).at(-1);
  const stops = d.stops.filter(k => !S[k].opt);
  const seq = [];
  const push = (k, extra) => { if (seq.length && seq.at(-1).k === k && !extra) return; seq.push({ k, ...extra }); };
  push(startKey, { start: true });
  for (const k of stops) { if (d.fly && k === d.fly[1]) push(k, { fly: true }); else push(k); }
  push(endKey);
  const legs = [], polys = []; let cur = null, km = 0, min = 0;
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i - 1].k, b = seq[i].k;
    if (seq[i].fly) { legs.push({ to: b, fly: true, min: FLIGHT_MIN }); cur = null; continue; }
    const r = legRoute(a, b);
    const pts = r.path.map(nodeXY);
    if (!cur) { cur = pts; polys.push(cur); } else cur.push(...pts.slice(1));
    legs.push({ to: b, km: Math.round(r.km), min: r5(r.min) });
    km += r.km; min += r5(r.min);
  }
  let spur = null;
  if (d.spur) { const r = legRoute(d.stops[0], "diana"); spur = r.path.map(nodeXY); }
  return { startKey, endKey, legs, polys, spur, km: Math.round(km), min };
}
const hm = m => [Math.floor(m / 60) && `${Math.floor(m / 60)}시간`, m % 60 && `${m % 60}분`].filter(Boolean).join(" ");

const llOf = k => (typeof k === "string" ? S[k].ll : k);
const hav = (a, b) => { const r = Math.PI / 180, R0 = 6371; const dLat = (b[1] - a[1]) * r, dLng = (b[0] - a[0]) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLng / 2) ** 2; return 2 * R0 * Math.asin(Math.sqrt(h)); };

const outDays = days.map(d => {
  const r = routeDay(d), m = DAYMETA[d.id] || {};
  const border = d.stops.some(k => S[k].kind === "border");
  const dist = `약 ${Math.round(r.km / 10) * 10}km · 운전 ${hm(r.min)}` + (d.fly ? ` + 비행 ${hm(FLIGHT_MIN)}` : "") + (border ? " + 국경" : "");
  return { id: d.id, grp: d.grp, title: d.title, stay: d.stay, dist, km: r.km, driveMin: r.min, tip: d.tip, stops: d.stops,
    start: m.start || "08:00", dw: m.dw || {}, legs: r.legs, startKey: r.startKey, endKey: r.endKey,
    polys: r.polys, fly: d.fly || null, spur: r.spur };
});
for (const d of outDays) console.log(d.id.padEnd(4), String(d.km).padStart(4), "km", hm(d.driveMin).padEnd(10), d.dist);

// road network for the in-page planner: node xy (projected) + lon/lat, edges with km/min
const roadNet = {
  xy: G.nodes.map(p => P(p)).flat(),
  ll: G.nodes.map(p => [Math.round(p[0] * 1e4) / 1e4, Math.round(p[1] * 1e4) / 1e4]).flat(),
  edges: G.edges.map(([a, b, c]) => { const e = G.adj[a].find(x => x[0] === b); return [a, b, Math.round(e[1] * 10) / 10, Math.round(e[2] * 10) / 10, c]; }).flat(),
  roadCount: G.roadCount, stopNode: G.stopNode, main: G.main.join(""), proj: { scale: proj.scale(), translate: proj.translate() },
};

const outStops = Object.fromEntries(Object.entries(S).map(([k, s]) => [k, { ...s, xy: P(s.ll) }]));

const labels = [
  { t: "오만", ll: [56.6, 20.9], cls: "country big" },
  { t: "아랍에미리트", ll: [54.4, 23.75], cls: "country" },
  { t: "사우디아라비아", ll: [51.6, 20.4], cls: "country" },
  { t: "예멘", ll: [51.4, 16.6], cls: "country" },
  { t: "이란", ll: [57.6, 26.55], cls: "country" },
  { t: "오만만", ll: [58.4, 24.5], cls: "sea" },
  { t: "아라비아해", ll: [58.6, 18.2], cls: "sea big" },
  { t: "룹알할리 사막", ll: [53.0, 19.6], cls: "region" },
  { t: "와히바 사막", ll: [58.55, 21.95], cls: "region" },
  { t: "하자르 산맥", ll: [57.2, 23.35], cls: "region" },
  { t: "도파르", ll: [54.2, 17.55], cls: "region" },
  { t: "무스카트", ll: [58.47, 23.73], cls: "city" },
  { t: "수르", ll: [59.53, 22.57], cls: "city", dot: [59.53, 22.566] },
  { t: "니즈와", ll: [57.53, 22.84], cls: "city" },
  { t: "이브리", ll: [56.515, 23.226], cls: "city", dot: [56.515, 23.226] },
  { t: "알아인", ll: [55.744, 24.207], cls: "city", dot: [55.744, 24.207], side: "l" },
  { t: "두바이", ll: [55.27, 25.20], cls: "city", dot: [55.2708, 25.2048] },
  { t: "소하르", ll: [56.72, 24.35], cls: "city", dot: [56.72, 24.35] },
  { t: "두큼", ll: [57.70, 19.67], cls: "city", dot: [57.70, 19.67] },
    { t: "샬랄라", ll: [54.05, 17.10], cls: "city" },
].map(l => ({ ...l, xy: P(l.ll), dot: l.dot ? P(l.dot) : null }));

const data = { W, H, countries, borders, stops: outStops, days: outDays, courses, labels, roadNet, flightMin: FLIGHT_MIN };
fs.writeFileSync(here("mapdata.json"), JSON.stringify(data));
console.log("bytes", fs.statSync(here("mapdata.json")).size);

console.log(countries.map(c => c.id + ":" + c.d.length).join(" "));
