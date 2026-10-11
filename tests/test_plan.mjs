// Planner editing: right-click menu adds, left click never adds by itself, cards, attraction layer.
import { start, check, nodes, openPlan, rightClickMap } from "./_setup.mjs";
const { page: p, finish } = await start();
await openPlan(p, "내 플랜");
await p.evaluate(() => { window.__mockMap.z = 8; window.__mockMap.ls.click({ latLng: { lat: () => 25.15, lng: () => 55.33 } }); });
await p.waitForTimeout(150);
check((await nodes(p)).length === 0, "left click on the map adds nothing");
check(!!(await p.$(".maphint")), "left click shows the right-click hint");
let menu = await rightClickMap(p, 25.15, 55.33);
check(menu[0].startsWith("*여기서 출발"), "empty plan: menu offers '여기서 출발'");
await p.click(".ctxmenu .cx-i.primary"); await p.waitForTimeout(300);
await rightClickMap(p, 22.93, 57.53); await p.click(".ctxmenu .cx-i.primary"); await p.waitForTimeout(300);
await rightClickMap(p, 17.02, 54.09); await p.click(".ctxmenu .cx-i.primary"); await p.waitForTimeout(300);
check((await nodes(p)).length === 3, "three points added from the menu");
menu = await rightClickMap(p, 22.38, 57.53);
check(menu.some(m => m.includes("사이에 넣기")) && menu.some(m => m.includes("맨 뒤")), "menu offers in-between and append");
await p.keyboard.press("Escape");
check(!(await p.$(".ctxmenu")), "Esc closes the menu");
await p.evaluate(() => window.__mockMap.ls.click({ latLng: { lat: () => 23.06, lng: () => 57.66 }, placeId: "ChIJplace123", stop() {} }));
await p.waitForTimeout(150);
check((await nodes(p)).length === 3 && await p.evaluate(() => !!window.__iwc.querySelector(".planbox button")), "left click on a Google place opens a card, adds nothing");
await p.click('[data-ins="1"]'); await p.waitForTimeout(100);
await p.evaluate(() => window.__mockMap.ls.click({ latLng: { lat: () => 24.8, lng: () => 56.2 } })); await p.waitForTimeout(300);
check((await nodes(p)).length === 4, "after '+ 이 사이에 넣기' a left click inserts");
// attraction layer
await p.click("#poiBtn"); await p.waitForTimeout(100);
check((await p.$$("#map .gm.poi")).length > 80, "attraction pins shown");
await p.evaluate(() => [...document.querySelectorAll("#map .gm.poi")].find(e => e.textContent.includes("와디 바니 칼리드")).click());
await p.waitForTimeout(150);
check(await p.evaluate(() => window.__iwOpen && window.__iwc.textContent.includes("Wadi Bani Khalid")), "attraction card opens");
await p.waitForTimeout(350);
await p.evaluate(() => window.__mockMap.ls.click({ latLng: { lat: () => 21, lng: () => 56 } }));
check(!(await p.evaluate(() => window.__iwOpen)), "clicking the map outside closes the card");
// transparency
await p.click("#visBtn");
await p.$eval("#poiT", e => { e.value = 60; e.dispatchEvent(new Event("input", { bubbles: true })); });
check((await p.evaluate(() => getComputedStyle(document.querySelector(".mapbox")).getPropertyValue("--poi-a"))).trim() === "0.40", "attraction pin transparency applies");
await finish();
