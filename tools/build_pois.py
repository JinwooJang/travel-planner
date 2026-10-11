"""Merge the per-region attraction research (src/data/pois-research/*.json) into src/data/pois.json."""
import json, math, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
base = str(ROOT / "src/data/pois-research") + "/"
order = ["muscat.json", "nw_oman_final.json", "dakhiliyah.json", "sharqiyah.json", "dhofar.json"]
items = []
for f in order: items += json.load(open(base + f, encoding="utf-8"))
by = {}
for it in items: by.setdefault(it["id"], []).append(it)
# Daymaniyat: one pin at the boat departure (drivable), keep the October landing rule from the Batinah research
dm = [it for it in items if it["id"] == "daymaniyat-islands"]
assert len(dm) == 2
mus = next(x for x in dm if x["region"] == "무스카트"); bat = next(x for x in dm if x["region"] == "바티나")
mus["ko"] = "다이마니야트 제도 (보트 출발: 알 무즈 마리나)"
mus["tips"] = ("5~10월에는 섬 해변에 상륙할 수 없어서 10월에는 보트 위 스노클링만 할 수 있어요(환경청, 2024년 기사). "
               "환경청 허가가 포함된 투어를 예약하고, 아이 나이 제한과 소요 시간은 투어사에 미리 확인하세요. 바닷길이 30km 남짓이라 멀미약을 챙기세요.")
mus["sources"] = mus["sources"] + [s for s in bat["sources"] if s not in mus["sources"]]
items = [it for it in items if it is not bat]
ids = [it["id"] for it in items]; assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
APPROX = {"sharaf-al-alamayn-viewpoint", "ibri-fort", "khor-najd", "al-sawadi-beach", "jebel-harim", "bandar-khayran",
          "fins-white-beach", "wahiba-sands", "masirah-island", "bar-al-hikman", "ain-athum", "rub-al-khali-dunes", "anti-gravity-point"}
CATS = {"culture", "fort", "nature", "mountain", "desert", "sea", "village"}
out = []
for it in items:
    assert it["cat"] in CATS, it
    lat, lng = float(it["lat"]), float(it["lng"])
    assert 16 < lat < 26.6 and 51.8 < lng < 60, it["id"]
    o = {k: it[k] for k in ("id", "ko", "en", "cat", "region", "desc", "tips", "visitMin", "family", "q")}
    o["ll"] = [round(lng, 5), round(lat, 5)]
    if it["id"] in APPROX: o["approx"] = 1
    o["src"] = it.get("sources", [])[:3]
    out.append(o)
# Oman Aquarium: the research pin was ~27 km off; Mall of Oman is in Bawshar next to the Sultan Qaboos Sports Complex (OSM via Mapcarta)
aq = next(o for o in out if o["id"] == "oman-aquarium"); aq["ll"] = [58.40501, 23.57191]
missing = APPROX - set(o["id"] for o in out); assert not missing, missing
# near-duplicates
def hav(a, b):
    r = math.pi / 180; dl = (b[1]-a[1])*r; dg = (b[0]-a[0])*r
    h = math.sin(dl/2)**2 + math.cos(a[1]*r)*math.cos(b[1]*r)*math.sin(dg/2)**2
    return 2*6371*math.asin(math.sqrt(h))
for i in range(len(out)):
    for j in range(i+1, len(out)):
        d = hav(out[i]["ll"], out[j]["ll"])
        if d < 0.3: print("close:", out[i]["id"], out[j]["id"], round(d*1000), "m")
from collections import Counter
print(len(out), Counter(o["cat"] for o in out), Counter(o["region"] for o in out))
json.dump(out, open(ROOT / "src/data/pois.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("bytes", len(json.dumps(out, ensure_ascii=False).encode()))
