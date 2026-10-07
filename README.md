# Signal911 — Call Surge Triage (Hackathon Prototype)

> **Identify duplicate 911 incident reports and flag high-priority cases for immediate dispatcher review.**

Signal911 is an **interactive, fully synthetic prototype** built for a hackathon problem: *After an incident, call volumes spike. Develop a way to identify duplicate reports and flag high-priority cases for immediate response.*

No accounts, API keys, external services, or build steps are required. It runs as a static website.

## Run locally

1. Clone this repository.
2. Open `index.html` in a browser, **or** run `python3 -m http.server 8000` and visit `http://localhost:8000`.
3. Click **Auto-play scenario** for the scripted end-to-end walkthrough (approximately 13 seconds), or click **Start first call** to operate the dispatcher interface manually.

## 60-second demo script

An existing structure fire at **245 Main Street** has already been reported as `INC-102`. Five more *fictional* reports arrive:

| Call | What arrives | Duplication suggestion | Independent urgency finding | Scripted dispatcher decision |
| --- | --- | --- | --- | --- |
| CALL-201 | More smoke at 245 Main St | Related to `INC-102` | Standard review | Confirm link to `INC-102` |
| CALL-202 | Child trapped inside 245 Main St | Related to `INC-102` | **Immediate review** | Link **and retain urgent update** |
| CALL-203 | Person not breathing at 3rd & Pine | New / unrelated | **Immediate review** | Create a separate urgent medical incident |
| CALL-204 | Explosion at **247** Main St | **Uncertain:** nearby address differs | **Immediate review** | Operator keeps separate, not blindly merged |
| CALL-205 | More fire/smoke at 245 Main St | Related to `INC-102` | Standard review | Confirm link to `INC-102` |

**Key product insight:** Duplicate detection and urgency detection are **independent**. A duplicate report can carry the most urgent piece of information in the entire incident.

Explore the dashboard's **incoming report queue**, **dispatcher review panel**, **incident board**, and **decision log**. The manual flow supports either **link to an active incident** or **create a separate incident** for suggested matches, with an audit entry for each decision. The scripted auto-play applies illustrative operator decisions, not autonomous dispatch actions.

## Deliberately constrained scope

- **P0 — Duplicate suggestions:** transparent location/time/incident-type matching, with evidence displayed next to each report.
- **P0 — Urgent case flags:** prototype keyword screening of caller transcripts, **even on related reports**.
- **P0 — Human review:** no report is merged, discarded, disconnected, or deprioritized automatically.
- **P0 — Walkthrough & audit:** fixed five-call sequence, incident consolidation, operator decisions, persistent in-session audit history.

There is **no** dispatch integration, real call transcription, GIS, computer-aided dispatch integration, call answering, or real AI model. All information shown is fabricated. For clarity and reproducibility, the prototype uses deterministic, explainable rules; the term *AI* should not be used to describe its actual implementation.

### How rule matching works

The simplified **heuristic score** is out of 100:

- Exact normalized address: **+65**, or same street but different street number **+24**.
- Same incident type: **+25**.
- Within a 15-minute time window: **+10**.

An exact-location, same-type report scoring 80+ is suggested as **related**; scores of 45+ without that strong evidence become **uncertain**; otherwise a **new incident** is suggested. These scores are **not statistical confidence or validated probabilities**. Urgency checks use a small list of expressions such as *trapped*, *not breathing*, *explosion* and *severe bleeding*. All decisions remain with the simulated operator.

## Safety and limitations

**NOT FOR EMERGENCY USE.** This software is for a hackathon demonstration only and is not a real emergency communications, 911, medical triage, or dispatch system. Do not deploy in a public-safety environment.

Potential real-world failure modes include misunderstood locations, inaccurate transcripts, dissimilar descriptions of the same incident, false urgent alerts, and critically dangerous missed alerts. This prototype has **not** been evaluated on operational 911 data. A real system would require extensive evaluation, stringent confidentiality and access controls, local dispatch protocol compliance, human factors testing, CAD vendor support, operational resilience, and public-safety agency authorization.

A banner states clearly that no live calls or services are connected. In this demo, acknowledging an urgency alert does **not** send help, change dispatch status, or affect any real-world system.

## Project structure

```text
index.html             Semantic page structure and interface sections
styles.css             Responsive visual design
src/engine.js          Isolated matching and urgency heuristics (Node-testable)
src/app.js             Synthetic incident state, guided scenario and controls
tests/engine.test.js    Scenario and edge-case tests
.github/workflows/ci.yml  Node test checks on push and pull request
```

## Tests

Requires Node 18 or newer:

```bash
node --test tests/engine.test.js
```

## Host on GitHub Pages

This is a static site: in the repository's **Settings → Pages**, choose **Deploy from a branch** and set branch `main` and folder `/ (root)`. GitHub will publish it once Pages is configured by the repository owner. The app itself does not need a backend. (The CSS imports an optional Google font; fallback system fonts work offline.)

## Suggested pitch

**Problem:** Surges generate repeated calls; urgent information can be buried inside them.

**Solution:** Every report receives *two independent classifications*: incident relationship and urgency. The dispatcher sees why it may match another incident, but retains the authority to confirm a link or keep cases separate.

**Proof point:** The second incoming call is both a duplicate **and** a high-priority update about a trapped child. Signal911 surfaces the danger instead of treating the report as redundant.

**Success measures for any future pilot:** Duplicate precision/recall, critical-alert recall, time to dispatcher awareness, false-merge rate, and dispatcher review time—with safety metrics prioritized over speed.