# 오만 로드트립 플래너 — 작업 메모

- 화면과 로직은 전부 `src/template.html` 한 파일에 있어요. 고친 뒤 `npm run build`로 `index.html`을 다시 만들어요. `index.html`을 직접 고치지 마세요.
- 결과물은 외부 의존 없이 혼자 도는 HTML 한 파일이어야 해요. 바깥에서 불러오는 건 Google Maps JS API와 Google Fonts뿐이에요.
- API 키는 절대 커밋하지 않아요. 키는 사용자가 화면에서 넣고 `localStorage`의 `omanGmaps.key`에만 저장돼요. `tools/assemble.py`가 데이터에 키가 섞였는지 검사해요.
- 화면 문구는 한국어 해요체, 시각은 24시간제(날짜가 바뀌면 `10/16(금) 08:00`처럼 날짜를 붙여요).
- 플랜에 지점이 들어가는 건 사용자가 분명히 고른 경우뿐이에요: 오른쪽 클릭 메뉴, 카드의 버튼, 검색 결과의 "플랜에 추가", "+ 이 사이에 넣기"를 누른 뒤의 클릭. 그냥 왼쪽 클릭으로 추가되게 만들지 마세요.
- 저장소 키: `omanGmaps.v1`(플랜 `plans`/`planId`, 화면 설정 `ui`, 코스 설정), `omanGmaps.routes`(구글 경로 캐시), `omanGmaps.places`(장소 이름 캐시), `omanGmaps.sheetW`(패널 폭). 형식을 바꾸면 예전 데이터를 옮기는 코드도 넣어 주세요.
- 플랜 파일 형식: `{ format: "oman-roadtrip-plan", version: 1, plans: [...], routes: {...} }`. 불러올 때는 모든 값을 검사해서 다시 만들어요(`cleanPt`).
- 테스트: `npm test`. 실제 구글 대신 `tests/gmock.js`를 끼워서 돌아요. UI를 바꾸면 테스트도 같이 고쳐 주세요.
