# Voice-First Smoke Tester 🎙️

**Does your "voice-first" app actually work by voice? Most developers test one with a mouse and their eyes. This tester tests it the way a blind user would — with its ears closed and its eyes shut.**

## The problem, in plain language

If you build an app for someone who can't see the screen — a medication helper, a banking app, a transit app — you can't check it by looking at it. You have to *use* it the way your user does: by voice, with no screen.

Nobody does that check. Developers build something, call it "voice-first," and test it by clicking around and watching the screen. That's like testing a wheelchair ramp by walking up it.

## What this does

Point it at any voice-first web app and it:

1. **Asks questions out loud** — the same questions a blind user would ask ("Did I take my morning pills?", "What's next?").
2. **Checks every answer was SPOKEN** — not just words shown silently on a screen. An answer that only appears on screen is a fail: a blind user hears silence.
3. **Checks answers are announced to screen readers** — the answer area needs `aria-live` or `role="status"`, or a screen-reader user hears nothing when it appears.
4. **Checks every feature has a voice path** — a label reader that needs a photo picked from a file dialog has no voice path. A blind user can't use it at all.
5. **Prints an eyes-closed coverage score** — what percentage of the tested questions a blind user can complete without seeing the screen.

## Run it

```bash
npm install
node src/run.js --target https://your-app.example.com --config tests/meds-helper.json --out report
```

Exit code `0` = no failures. Exit code `1` = the app leaves a blind user stuck somewhere. The full report lands in `report/report.html` (open it in a browser) and `report/report.json`.

Write your own question set as a JSON file: a `target` URL and a list of questions, each with the control to click (`selector`), the words a user would say (`spoken`), and where the answer appears (`answerSelector`).

## What it found on its first target

First target: the Daily Meds Helper (a voice-first medication helper for an older adult with poor vision — [live demo](https://davidcareins-coder.github.io/daily-meds-helper/)). Run on Nov 24, 2026: **8 passed, 4 failed, 80% eyes-closed coverage**.

- ✅ Every routine question got a spoken answer — the app speaks every answer out loud.
- ❌ The answer area has no `aria-live` — a screen-reader user hears nothing when an answer appears.
- ❌ The weekly summary is silent when the cloud call fails — the app only speaks the summary when the cloud AI succeeds; a failed summary is written on screen and never spoken, in any environment.
- ❌ The prescription label reader has no voice path — it needs a photo from a file picker, which a blind user can't do.

See the full run in [`report/report.html`](report/report.html).

**How the run was done:** the test ran against a local copy of the live deploy (same files, verified byte-identical by download + diff, except the Firebase config, which is a placeholder locally so the app runs in demo mode). This VM's Chromium cannot reach the internet through the egress proxy, so the live URL couldn't be driven directly. The local copy's import map points at a local bundle of the same Firebase SDK (firebase@13.3.0, built with esbuild from the app's own node_modules); in demo mode the SDK is never called, and all UI, speech and schedule code under test is identical to the live deploy.

## Verified with Kane CLI

This project was built for the KaneCLI Online Hackathon (Nov 12–26, 2026). Kane CLI — describe a flow in plain English, get a pass or fail from a real browser — verified the tester itself. See [`kane/`](kane/) for the objectives and the verification run.

```bash
bash kane/verify.sh   # needs a TestMu AI account (free, 10,000 credits)
```

## Tech

Node + Playwright (real Chromium). No paid APIs, no secrets, no keys in this repo. $0 to run.

## License

Apache-2.0 — same as the Daily Meds Helper it was first tested against.
