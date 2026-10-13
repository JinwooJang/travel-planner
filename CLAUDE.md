# 오만 로드트립 플래너 — 작업 메모

- 화면과 로직은 전부 `src/template.html` 한 파일에 있어요. 고친 뒤 `npm run build`로 `index.html`을 다시 만들어요. `index.html`을 직접 고치지 마세요.
- 화면은 빌드된 `index.html` 한 파일이에요(Vercel에서는 공유 링크 `/s/<id>`도 이 파일로 열려요). 서버 쪽은 `api/`의 Vercel 함수(의존성 없이 Node 내장 기능과 `fetch`만)이고, 공유 데이터는 Supabase(`supabase/schema.sql`)에 있어요. 브라우저는 Google Maps JS API, Google Fonts, 같은 주소의 `/api`만 불러요.
- API 키는 절대 커밋하지 않아요. 키는 사용자가 화면에서 넣고 `localStorage`의 `omanGmaps.key`에만 저장돼요. `tools/assemble.py`가 데이터에 키가 섞였는지 검사해요.
- 서버 비밀값(`SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OWNER_TOKEN`, `GMAPS_VIEW_KEY`)은 Vercel 환경변수에만 둬요. Supabase 키는 브라우저로 보내지 않고, `api/`가 공유 비밀번호를 확인한 뒤에만 써요. 표에는 RLS 정책을 만들지 않아요(공개 키로는 아무것도 못 하게).
- 공유 화면(`SHARE_ID`)은 보기 전용이에요. 받은 플랜은 메모리에만 두고 보는 사람의 저장소(플랜, 경로 캐시, 키)에 쓰지 않아요. 보기 전용 키는 지도만 되니 Routes·Places를 부르지 않아요. 플래너에만 필요한 화면 요소에는 `ns` 클래스를 붙여 공유 화면에서 숨겨요. 받은 데이터는 `cleanPlanFile`로 검사해요.
- 화면 문구는 한국어 해요체, 시각은 24시간제(날짜가 바뀌면 `10/16(금) 08:00`처럼 날짜를 붙여요).
- 플랜에 지점이 들어가는 건 사용자가 분명히 고른 경우뿐이에요: 오른쪽 클릭 메뉴(폰은 길게 누르기, `lpFire`), 카드의 버튼, 검색 결과의 "플랜에 추가", "+ 이 사이에 넣기"를 누른 뒤의 클릭. 그냥 왼쪽 클릭으로 추가되게 만들지 마세요.
- 보기 모드(`ui.view`)에서는 플랜과 시간이 바뀌면 안 돼요. 플랜이나 시간을 바꾸는 버튼을 새로 넣으면 `eo` 클래스를 붙여서 보기 모드에서 숨기고, 값을 보여 주는 고르기 칸은 `disabled`로 잠가요(`renderSheet`, `renderWhen`). 지도 메뉴(`openCtx`)는 보기 모드에서 추가 항목을 빼고, `extra` 중 `view: true`인 것만 남겨요.
- 지도 위 글자는 "표시" 패널(`DISP`)에서 종류별로 켜고 꺼요. 숨긴 종류는 `ui.hide`에 저장되고 `.mapbox`에 `no-<키>` 클래스가 붙어요. 지도에 글자를 새로 넣으면 `DISP`에 항목과 숨기는 CSS도 같이 넣어 주세요.
- 내 위치는 "내 위치" 버튼을 눌렀을 때만 켜요. 페이지를 열자마자 권한을 묻지 않고, 위치는 어디에도 저장하지 않아요.
- 저장소 키: `omanGmaps.v1`(플랜 `plans`/`planId`, 화면 설정 `ui`, 코스 설정), `omanGmaps.routes`(구글 경로 캐시), `omanGmaps.places`(장소 이름 캐시), `omanGmaps.sheetW`(패널 폭), `omanGmaps.share`(공유 비밀번호, 플랜별 공유 ID). 형식을 바꾸면 예전 데이터를 옮기는 코드도 넣어 주세요.
- 플랜 파일 형식: `{ format: "oman-roadtrip-plan", version: 1, plans: [...], routes: {...} }`. 불러올 때는 모든 값을 검사해서 다시 만들어요(`cleanPt`).
- 테스트: `npm test`. 실제 구글 대신 `tests/gmock.js`, 실제 Supabase 대신 `tests/fakebase.mjs`를 끼워서 돌아요(`test_api.mjs`는 함수만, `test_live.mjs`는 로컬 서버로 공유 전체 흐름). UI나 `api/`를 바꾸면 테스트도 같이 고쳐 주세요.
- 배포: `main`에 올라가면 Vercel이 `vercel.json`대로 `index.html`(→ `public/`)과 `api/`를 배포해요. `.github/workflows/pages.yml`도 `index.html` 하나만 GitHub Pages(https://jinwoojang.github.io/travel-planner/)에 계속 올려요(거기서는 실시간 공유가 안 돼요). 빌드는 저장소에서 하므로 `npm run build` 결과를 꼭 같이 커밋해요.
