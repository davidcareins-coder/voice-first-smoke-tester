// Voice-First Smoke Tester — runner.
// Pretends to be a blind user: asks a voice-first web app questions out loud
// (via the app's own question controls, the same ones its voice button feeds),
// then checks whether each question got a SPOKEN answer — not just words
// silently shown on a screen. A voice-first app that answers only on screen
// leaves a blind user stuck, so that is a FAIL.
//
// Usage:
//   node src/run.js --target <url> --config tests/meds-helper.json --out report
//
// Output: report.json + report.html in --out. Exit 0 = no failures, 1 = failures.

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const TARGET = arg("--target", "https://davidcareins-coder.github.io/daily-meds-helper/");
const CONFIG = arg("--config", path.join(__dirname, "..", "tests", "meds-helper.json"));
const OUTDIR = arg("--out", path.join(__dirname, "..", "report"));
const WAIT_MS = parseInt(arg("--wait-ms", "8000"), 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(id, name, status, detail, evidence) {
  return { id, name, status, detail, evidence: evidence || "" };
}

async function main() {
  const started = new Date();
  const config = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  const target = config.target || TARGET;
  const checks = [];
  const spokenLog = [];
  let shotBefore = null;
  let shotAfter = null;

  const proxyRaw = process.env.HTTPS_PROXY || process.env.https_proxy || "";
  let proxyOpt = undefined;
  try {
    if (proxyRaw) {
      const u = new URL(proxyRaw);
      proxyOpt = {
        server: `${u.protocol}//${u.hostname}:${u.port || 3128}`,
        bypass: "localhost,127.0.0.1",
        ...(u.username ? { username: decodeURIComponent(u.username) } : {}),
        ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
      };
    }
  } catch { /* no proxy */ }
  const browser = await chromium.launch({
    ...(proxyOpt ? { proxy: proxyOpt } : {}),
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    ignoreHTTPSErrors: true,
  });

  // Hook speechSynthesis.speak BEFORE any page script runs, so every spoken
  // answer is recorded even if the page speaks the instant it answers.
  await page.addInitScript(() => {
    window.__vfst_spoken = [];
    window.__vfst_speak_supported = "speechSynthesis" in window;
    try {
      const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = function (utterance) {
        window.__vfst_spoken.push({
          text: utterance && utterance.text ? utterance.text : "",
          at: Date.now(),
        });
        return orig(utterance);
      };
    } catch (e) {
      window.__vfst_speak_hook_error = String(e);
    }
  });

  page.on("pageerror", (err) => {
    checks.push(check("page-error", "No page errors during run", "info", String(err).slice(0, 200)));
  });

  console.log(`Voice-First Smoke Tester\nTarget: ${target}\n`);
  await page.goto(target, { waitUntil: "networkidle", timeout: 60000 });
  await sleep(3000);
  shotBefore = path.join(OUTDIR, "shot-loaded.png");
  await page.screenshot({ path: shotBefore, fullPage: false });

  // --- Static checks: does the app even offer voice in / voice out? ---
  const caps = await page.evaluate(() => ({
    title: document.title,
    hasMicButton: !!document.querySelector("#mic-btn"),
    voiceButtons: [...document.querySelectorAll("button")].filter((b) =>
      /voice|mic|🎤|speak|listen/i.test(b.textContent || "")
    ).length,
    speechRecognition:
      !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    speechSynthesis: "speechSynthesis" in window,
    answerLive:
      (() => {
        const a = document.querySelector("#answer");
        if (!a) return "missing #answer element";
        const live = a.getAttribute("aria-live");
        const role = a.getAttribute("role");
        if (live) return `aria-live="${live}"`;
        if (role === "status" || role === "alert") return `role="${role}"`;
        return "none — #answer has no aria-live and no role=status/alert";
      })(),
  }));

  checks.push(
    check("page-loads", "Page loads", caps.title ? "pass" : "fail",
      caps.title ? `Title: "${caps.title}"` : "No page title — page did not load."),
    check("voice-in-offered", "Voice input is offered",
      caps.hasMicButton || caps.voiceButtons > 0 ? "pass" : "fail",
      caps.hasMicButton
        ? "Microphone button (#mic-btn) is on the page."
        : caps.voiceButtons > 0
          ? `${caps.voiceButtons} voice-related button(s) found.`
          : "No microphone button and no voice-related button anywhere on the page. A blind user has no way to ask anything."),
    check("voice-in-api", "Speech recognition API exists in this browser",
      caps.speechRecognition ? "pass" : "env",
      caps.speechRecognition
        ? "SpeechRecognition is available — the mic button can actually listen."
        : "SpeechRecognition is NOT in this browser (headless Chromium has none). The mic button exists, but in this browser it cannot listen. Re-run in real Chrome to verify live listening."),
    check("voice-out-api", "Speech synthesis API exists in this browser",
      caps.speechSynthesis ? "pass" : "fail",
      caps.speechSynthesis
        ? "speechSynthesis is available — the app can speak answers aloud."
        : "speechSynthesis is missing. The app has no way to speak anything."),
    check("answer-announced", "Answers are announced to screen readers",
      caps.answerLive.startsWith("none") ? "fail" : "pass",
      caps.answerLive.startsWith("none")
        ? "The answer area (#answer) has no aria-live and no role=status. A screen-reader user hears nothing when an answer appears — the answer only exists visually. Spoken speechSynthesis output does not fix this for screen-reader users."
        : `Answer area announces itself: ${caps.answerLive}.`)
  );

  // --- Per-question checks: ask, then demand a spoken answer. ---
  let asked = 0;
  let spokenCount = 0;
  for (const q of config.questions) {
    asked += 1;
    const before = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.textContent.trim() : null;
    }, q.answerSelector);
    const spokenBefore = await page.evaluate(() => window.__vfst_spoken.length);
    const clicked = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.click();
      return true;
    }, q.selector);
    if (!clicked) {
      checks.push(check(`q-${q.id}`, `Question "${q.spoken}" gets a spoken answer`, "fail",
        `Could not find the control (${q.selector}) on the page. The question cannot be asked at all.`));
      continue;
    }
    // Wait for the answer text to change from what it was.
    let answerText = before;
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      answerText = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.textContent.trim() : null;
      }, q.answerSelector);
      if (answerText && answerText !== before) break;
      await sleep(250);
    }
    await sleep(800); // let any follow-up AI re-phrasing + speaking settle
    const spoken = await page.evaluate(() => window.__vfst_spoken.slice());
    const newSpoken = spoken.slice(spokenBefore);
    newSpoken.forEach((s) => spokenLog.push({ question: q.id, ...s }));
    const spokenMatch = newSpoken.find((s) => {
      if (!answerText || !s.text) return false;
      const a = answerText.slice(0, 40).toLowerCase();
      const t = s.text.toLowerCase();
      return t.includes(a) || a.includes(t.slice(0, 40));
    });
    const answered = !!answerText && answerText !== before;
    if (answered && spokenMatch) {
      spokenCount += 1;
      checks.push(check(`q-${q.id}`, `Question "${q.spoken}" gets a spoken answer`, "pass",
        `Answer appeared and was spoken aloud: "${spokenMatch.text.slice(0, 120)}"`,
        `On-screen answer: "${String(answerText).slice(0, 160)}"`));
    } else if (answered && newSpoken.length > 0) {
      spokenCount += 1;
      checks.push(check(`q-${q.id}`, `Question "${q.spoken}" gets a spoken answer`, "pass",
        `Answer appeared and something was spoken, but the spoken words did not match the on-screen answer. Spoken: "${newSpoken[0].text.slice(0, 120)}"`,
        `On-screen answer: "${String(answerText).slice(0, 160)}"`));
    } else if (answered) {
      checks.push(check(`q-${q.id}`, `Question "${q.spoken}" gets a spoken answer`, "fail",
        `The answer appeared ON SCREEN ONLY — nothing was spoken. A blind user hears silence. On-screen answer: "${String(answerText).slice(0, 160)}"`,
        "speechSynthesis.speak was never called for this question."));
    } else {
      checks.push(check(`q-${q.id}`, `Question "${q.spoken}" gets a spoken answer`, "fail",
        `No answer appeared at all within ${WAIT_MS / 1000}s. The user is left waiting with nothing.`,
        `Answer area still shows: "${String(before).slice(0, 120)}"`));
    }
    if (q.id === "morning") {
      await page.screenshot({ path: path.join(OUTDIR, "shot-answer.png") });
    }
  }

  // --- No-voice-path check: can a voice-only user read a prescription label? ---
  const label = await page.evaluate(() => {
    const input = document.querySelector("#label-photo");
    if (!input) return { exists: false };
    const section = input.closest("section");
    const voiceNear = section
      ? [...section.querySelectorAll("button")].filter((b) => /voice|mic|🎤|speak/i.test(b.textContent || "")).length
      : 0;
    return { exists: true, voiceNear };
  });
  checks.push(
    label.exists
      ? check("voice-path-label", "Prescription label reader has a voice path",
        label.voiceNear > 0 ? "pass" : "fail",
        label.voiceNear > 0
          ? "A voice control exists near the label reader."
          : "The label reader needs a PHOTO chosen from a file picker. There is no voice way to do that — no 'describe the label to me' or voice-guided capture. A blind user cannot use this feature at all.")
      : check("voice-path-label", "Prescription label reader has a voice path", "skip", "No label reader on the page.")
  );

  const coverage = asked ? Math.round((spokenCount / asked) * 100) : 0;
  checks.push(check("eyes-closed", "Eyes-closed coverage",
    coverage === 100 ? "pass" : "fail",
    `${spokenCount} of ${asked} tested questions produced a spoken answer (${coverage}%). A blind user can complete ${coverage}% of what was tested without seeing the screen.`));

  shotAfter = path.join(OUTDIR, "shot-final.png");
  await page.screenshot({ path: shotAfter, fullPage: true });
  await browser.close();

  const finished = new Date();
  const fails = checks.filter((c) => c.status === "fail").length;
  const passes = checks.filter((c) => c.status === "pass").length;
  const report = {
    tool: "voice-first-smoke-tester",
    version: "1.0.0",
    target,
    targetNote: config.targetNote || "",
    startedAt: started.toISOString(),
    finishedAt: finished.toISOString(),
    durationMs: finished - started,
    summary: { total: checks.length, pass: passes, fail: fails, coveragePercent: coverage },
    checks,
    spokenLog,
  };

  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, "report.json"), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUTDIR, "report.html"), renderHtml(report));
  console.log(`\n${passes} passed, ${fails} failed, ${checks.length - passes - fails} other.`);
  console.log(`Eyes-closed coverage: ${coverage}% (${spokenCount}/${asked} questions spoken).`);
  console.log(`Report: ${path.join(OUTDIR, "report.html")}`);
  process.exit(fails > 0 ? 1 : 0);
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(r) {
  const badge = (s) =>
    s === "pass" ? "✅ PASS" : s === "fail" ? "❌ FAIL" : s === "env" ? "⚠️ ENV" : s === "skip" ? "⏭️ SKIP" : s.toUpperCase();
  const rows = r.checks.map((c) => `<tr>
      <td><strong>${badge(c.status)}</strong></td>
      <td><strong>${esc(c.name)}</strong><br><span class="detail">${esc(c.detail)}</span>${c.evidence ? `<br><span class="evidence">${esc(c.evidence)}</span>` : ""}</td>
    </tr>`).join("\n");
  const spoken = r.spokenLog.map((s) => `<li><strong>${esc(s.question)}:</strong> “${esc(s.text)}”</li>`).join("\n") || "<li>No spoken answers were recorded.</li>";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Voice-First Smoke Test — report</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#1c2430;line-height:1.5}
h1{font-size:1.6rem}.pill{display:inline-block;padding:.2rem .7rem;border-radius:999px;font-weight:700;background:#eef2ff}
table{border-collapse:collapse;width:100%;margin-top:1rem}td,th{border:1px solid #d7dce3;padding:.6rem .7rem;vertical-align:top;text-align:left}
.detail{color:#374151}.evidence{color:#6b7280;font-size:.9em}
ul{background:#f7f8fa;padding:1rem 1rem 1rem 2rem;border-radius:8px}
footer{color:#6b7280;font-size:.85em;margin-top:2rem}
</style></head><body>
<h1>🎙️ Voice-First Smoke Test — report</h1>
<p><span class="pill">${r.summary.pass} passed · ${r.summary.fail} failed · ${r.summary.total} checks</span></p>
<p><strong>Target:</strong> <a href="${esc(r.target)}">${esc(r.target)}</a>${r.targetNote ? `<br><strong>Note:</strong> ${esc(r.targetNote)}` : ""}<br>
<strong>Run:</strong> ${esc(r.startedAt)} · <strong>Eyes-closed coverage:</strong> ${r.summary.coveragePercent}%</p>
<p>This tester pretends to be a blind user. It asks the app questions and checks whether each one gets a <strong>spoken</strong> answer — not just words shown silently on a screen.</p>
<table><tr><th>Result</th><th>Check</th></tr>${rows}</table>
<h2>Everything the app spoke aloud</h2><ul>${spoken}</ul>
<footer>voice-first-smoke-tester v${esc(r.version)} · A FAIL means a blind user is stuck at that step. ENV means the check needs a real browser, not headless Chromium.</footer>
</body></html>`;
}

main().catch((err) => {
  console.error("RUNNER ERROR:", err && err.message ? err.message : err);
  process.exit(2);
});
