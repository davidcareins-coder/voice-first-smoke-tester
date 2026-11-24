# Launch posts — DRAFTS ONLY, do not post without David's approval

## Post 1 — X / LinkedIn

Built something small for the KaneCLI hackathon.

It's called Voice-First Smoke Tester. If you build an app for someone who can't see the screen, you can't test it by looking at it. This tester asks your app questions out loud and checks every answer was actually spoken — not just shown on the screen.

First run against my meds helper: 8 passed, 4 failed, 80% eyes-closed coverage. It caught real stuff — like the answer area having no aria-live, so screen reader users hear nothing when an answer appears.

Code + full report: https://github.com/davidcareins-coder/voice-first-smoke-tester

If you have to see it to use it, it isn't finished yet.

## Post 2 — Hacker News / Reddit (Show HN)

Show HN: Voice-First Smoke Tester — does your voice-first app actually work by voice?

Developers build voice-first apps, then test them with a mouse and their eyes. That's like testing a wheelchair ramp by walking up it.

This tester pretends to be a blind user. Point it at a web app and it asks questions out loud, checks every answer was spoken (not just shown on screen), checks answers are announced to screen readers, and checks every feature has a voice path. Then it prints an eyes-closed coverage score.

First target was my own Daily Meds Helper (a voice-first medication helper). 12 checks, 8 passed, 4 failed, 80% coverage. Real catches: the answer area has no aria-live, a failed weekly summary is never spoken, and the label reader needs a photo from a file picker — no voice path at all.

Node + Playwright, no paid APIs, $0 to run. Verified with Kane CLI (objectives in the repo). Demo video coming soon.

https://github.com/davidcareins-coder/voice-first-smoke-tester
