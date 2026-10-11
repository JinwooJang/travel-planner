"""Build index.html: src/template.html + src/data/gdata.json + src/data/pois.json -> ../index.html (one self-contained file)."""
import json, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
tpl = (ROOT / "src/template.html").read_text(encoding="utf-8")
data = json.loads((ROOT / "src/data/gdata.json").read_text(encoding="utf-8"))
data["pois"] = json.loads((ROOT / "src/data/pois.json").read_text(encoding="utf-8"))
txt = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
out = tpl.replace("__DATA__", txt)
assert "AIza" not in txt, "data must never contain an API key"
(ROOT / "index.html").write_text(out, encoding="utf-8")
print("index.html", len(out.encode("utf-8")), "bytes")
