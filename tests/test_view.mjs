// View / edit switch (nothing can change in view mode) and the my-location dot (fake GPS, nothing stored).
import { start, check, nodes, openPlan, rightClickMap } from "./_setup.mjs";
const { page: p, finish } = await start();
await openPlan(p, "차로만");
const n0 = (await nodes(p)).length;
const vis = sel => p.$$eval(sel, e => e.filter(x => x.checkVisibility()).length);
const pins = () => p.evaluate(() => window.__ames.filter(m => m.map && m.content.classList.contains("pp")).map(m => m.draggable));
const EDIT = "[data-del],[data-up],[data-ins],[data-mode],[data-fly],[data-legpad],[data-pre],[data-undo],[data-clear],[data-saveas],[data-rename],[data-delplan],[data-loadc],[data-pick]";
check(await vis("[data-del]") > 0 && (await pins()).every(d => d), "edit mode: edit buttons shown, plan pins draggable");

// hourly marks on the route: time and km each on/off, both off hides the marks
const marks = async () => ({ ticks: await vis("#map .gm.tick"), tm: await vis("#map .gm.tick .tm"), km: await vis("#map .gm.tick .km") });
let mk = await marks();
check(mk.ticks > 0 && mk.tm === mk.ticks && mk.km === mk.ticks, "hourly marks show time and km by default");
await p.click("#tickTm");
mk = await marks();
check(mk.ticks > 0 && mk.tm === 0 && mk.km === mk.ticks && await p.$eval("#tickTm", e => e.getAttribute("aria-pressed")) === "false", "time switch off: only km left");
await p.click("#tickKm");
check((await marks()).ticks === 0, "both off: no marks at all");
await p.reload(); await p.waitForTimeout(1200);
check((await marks()).ticks === 0 && await p.$eval("#tickKm", e => e.getAttribute("aria-pressed")) === "false", "mark switches are remembered after reload");
await p.click("#tickTm");
mk = await marks();
check(mk.ticks > 0 && mk.tm === mk.ticks && mk.km === 0 && await p.$$eval("#map .gm.tick .kmx", e => e.length && e.every(x => getComputedStyle(x).display === "none")), "time only: km hidden, also in the hover detail");
await p.click("#tickKm");

// view mode
await p.click("#viewBtn"); await p.waitForTimeout(200);
check(await p.$eval("#viewBtn", e => e.getAttribute("aria-pressed")) === "true" && await p.evaluate(() => document.body.classList.contains("viewonly")), "view button turns view mode on");
check(await vis(EDIT) === 0, "view mode hides every edit control (sheet and map bar)");
check((await pins()).length > 0 && (await pins()).every(d => !d), "view mode: plan pins can't be dragged");
check(await p.$eval("#planPad", e => e.disabled) && await p.$$eval("#whenUI select", e => e.length && e.every(x => x.disabled)), "view mode: plan % and departure date/time are locked");
check(!(await p.$('#planSel option[value="__new"]')), "view mode: no '새 빈 플랜' in the plan list");
let menu = await rightClickMap(p, 23.5, 57.0);
check(!menu.some(m => /추가|넣기|출발/.test(m)) && !!(await p.$(".ctxmenu .cx-note")), "view mode: right-click menu has no add items and says why");
await p.keyboard.press("Escape");
await p.evaluate(() => document.querySelector("#map .gm.pp").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })));
menu = await p.$$eval(".ctxmenu .cx-i", e => e.map(x => x.textContent.trim()));
check(menu.some(m => m.includes("플랜 목록에서 보기")) && !menu.some(m => /삭제|넣을 곳/.test(m)), "view mode: plan pin menu keeps only '목록에서 보기'");
await p.keyboard.press("Escape");
await p.evaluate(() => window.__mockMap.ls.click({ latLng: { lat: () => 23.06, lng: () => 57.66 }, placeId: "ChIJview", stop() {} }));
await p.waitForTimeout(150);
check(await p.evaluate(() => window.__iwOpen && !window.__iwc.querySelector(".planbox [data-ci]") && window.__iwc.textContent.includes("보기 모드")), "view mode: place card offers no 'add to plan'");
check((await nodes(p)).length === n0, "view mode: the plan did not change");
await p.reload(); await p.waitForTimeout(1200);
check(await p.evaluate(() => document.body.classList.contains("viewonly")) && await vis("[data-del]") === 0, "view mode is remembered after reload");
await p.goto(new URL("../index.html", import.meta.url).href + "#c6cd1"); await p.reload(); await p.waitForTimeout(1200);
check(await p.$$eval(".sheet [data-t24h], #coursePad", e => e.length && e.every(x => x.disabled)) && await vis("[data-load]") === 0, "view mode: built-in course times locked, 'load as plan' hidden");

// back to edit
await p.click("#editBtn"); await p.waitForTimeout(200);
check(!(await p.$eval("#coursePad", e => e.disabled)) && await vis("[data-load]") === 1 && await p.$$eval("#whenUI select", e => e.every(x => !x.disabled)), "edit button unlocks again");

// my location with a fake GPS
await p.evaluate(() => {
  const g = { cb: null, watches: 0, cleared: 0, watchPosition(ok, err) { g.watches++; g.cb = { ok, err }; return g.watches; }, clearWatch() { g.cleared++; g.cb = null; }, getCurrentPosition() {} };
  Object.defineProperty(navigator, "geolocation", { value: g, configurable: true });
  window.__geo = g;
  window.__fix = (lat, lng, acc, heading = null, speed = null) => g.cb.ok({ coords: { latitude: lat, longitude: lng, accuracy: acc, heading, speed } });
});
await p.click("#locBtn"); await p.waitForTimeout(50);
check(await p.evaluate(() => window.__geo.watches === 1) && await p.$eval("#locBtn", e => e.classList.contains("busy")), "location button starts watching (searching state)");
await p.evaluate(() => window.__fix(23.61234, 58.54321, 25, 90, 15)); await p.waitForTimeout(50);
check(!!(await p.$("#map .gm.me.moving")) && await p.evaluate(() => window.__circles.at(-1).o.radius === 25 && !!window.__circles.at(-1).o.map), "blue dot, heading cone and 25 m accuracy circle shown");
check(await p.$eval("#locBtn", e => e.getAttribute("aria-pressed") === "true" && !e.classList.contains("busy")) && await vis("#locOff") === 1, "button shows on, with an off button");
check(await p.evaluate(() => !Object.keys(localStorage).some(k => (localStorage.getItem(k) || "").includes("58.54321"))), "location is not stored");
await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
check(await p.evaluate(() => window.__geo.cleared === 1) && !!(await p.$("#map .gm.me.stale")), "hidden page pauses GPS, dot turns grey");
await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
check(await p.evaluate(() => window.__geo.watches === 2), "visible again resumes GPS");
await p.evaluate(() => window.__fix(23.61234, 58.54321, 25)); await p.waitForTimeout(50);
await p.evaluate(() => document.querySelector("#map .gm.me .dot").click()); await p.waitForTimeout(50);
menu = await p.$$eval(".ctxmenu .cx-i", e => e.map(x => (x.classList.contains("primary") ? "*" : "") + x.textContent.trim()));
check(await p.$eval(".ctxmenu .cx-h", e => e.textContent.includes("내 위치 · 오차 약 25m")) && menu[0].startsWith("*") && menu.some(m => m.includes("내 위치 끄기")), "tapping the dot opens a menu: add to plan, turn off");
await p.click(".ctxmenu .cx-i.primary"); await p.waitForTimeout(400);
check((await nodes(p)).length === n0 + 1, "'add' from the dot menu puts my location into the plan");
await p.click("#viewBtn"); await p.waitForTimeout(150);
await p.evaluate(() => document.querySelector("#map .gm.me .dot").click()); await p.waitForTimeout(50);
menu = await p.$$eval(".ctxmenu .cx-i", e => e.map(x => x.textContent.trim()));
check(menu.some(m => m.includes("내 위치 끄기")) && !menu.some(m => /추가|넣기|출발/.test(m)), "view mode: dot menu only offers turning it off");
await p.keyboard.press("Escape"); await p.click("#editBtn"); await p.waitForTimeout(150);
await p.click("#locOff"); await p.waitForTimeout(50);
check(!(await p.$("#map .gm.me")) && await p.evaluate(() => !window.__circles.at(-1).o.map && window.__geo.cb === null) && await p.$eval("#locBtn", e => e.getAttribute("aria-pressed")) === "false", "off button removes the dot and stops GPS");
await p.click("#locBtn"); await p.evaluate(() => window.__geo.cb.err({ code: 1 })); await p.waitForTimeout(50);
check(await vis("#locMsg") === 1 && (await p.textContent("#locMsg")).includes("권한") && await p.$eval("#locBtn", e => e.getAttribute("aria-pressed")) === "false", "permission denied: explains how to allow, turns off");
await finish();
