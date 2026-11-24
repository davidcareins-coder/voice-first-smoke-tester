# Kane CLI objectives — Voice-First Smoke Tester

Kane CLI describes a flow in plain English and returns pass or fail from a real
browser. These are the objectives we ran against the tester itself and against
its first target, the Daily Meds Helper. Run them with `bash kane/verify.sh`.

## Objective 1 — the tester’s report page works end to end

> Open https://davidcareins-coder.github.io/voice-first-smoke-tester/report.html
> and confirm the page loads, shows a pass/fail table with at least 10 checks,
> and shows an "Eyes-closed coverage" percentage. Fail if the page does not
> load or the table is missing.

## Objective 2 — the target app answers a question out loud

> Open https://davidcareins-coder.github.io/daily-meds-helper/ and click the
> button "Did I take my morning pills?". Confirm the Answer area changes from
> its placeholder text to a real answer. Fail if the answer area stays on the
> placeholder or the page errors.

## Objective 3 — Kane catches the real failure

> Open https://davidcareins-coder.github.io/daily-meds-helper/ and confirm the
> Answer area has no aria-live attribute and no role of status or alert. This
> is the failure our tester caught: a screen-reader user hears nothing when an
> answer appears. Pass if the missing announcement is confirmed.

## What the closed loop looks like

Our agent (the tester) runs checks in a real browser. Kane CLI re-runs the same
flows in plain English and confirms or catches the same results independently.
When Kane disagrees with the tester, the tester is wrong — that disagreement is
the loop. The full run log is in `kane/verification-log.txt`.
