// Extra driving time: plan-wide %, per-leg override, built-in course %.
import { start, check, openPlan } from "./_setup.mjs";
const { page: p, finish } = await start();
await openPlan(p, "차로만");
const leg = i => p.$$eval(".tl .leg[data-leg] .lt", (e, i) => e[i].textContent, i);
const before = await leg(1);
await p.selectOption("#planPad", "10"); await p.waitForTimeout(300);
const after = await leg(1);
check(before !== after && (await p.textContent(".tl .leg[data-leg]")).includes("+10%"), "plan-wide 10% lengthens legs");
(await p.$$("[data-legpad]"))[1].selectOption("30"); await p.waitForTimeout(300);
check((await p.$$eval(".tl .leg[data-leg]", e => e[1].textContent)).includes("+30%") && (await p.$$(".padsel.own")).length === 1, "per-leg override");
await p.click("[data-padreset]"); await p.waitForTimeout(300);
check((await p.$$(".padsel.own")).length === 0 && await p.$eval("#planPad", e => e.value) === "10", "reset clears overrides, keeps plan %");
await p.goto(new URL("../index.html", import.meta.url).href + "#c6c"); await p.reload(); await p.waitForTimeout(1200);
const d0 = await p.textContent(".daylist li");
await p.selectOption("#coursePad", "20"); await p.waitForTimeout(300);
check(d0 !== await p.textContent(".daylist li"), "built-in course % changes the day times");
await finish();
