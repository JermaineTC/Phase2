# Test results

Inputs and expected results: `samples/test-cases.txt`.
Each stage says **who ran the tests and how**.

---

## Stage 1 – Scaffold (spec 01)

*Run by Claude Code: simulated pastes and clicks in headless Chrome. Then my own run: Ctrl+V in Chrome.*

| Sample | Expected | Actual |
|---|---|---|
| fake-reference.txt | Not found, flagged | Red highlight, counter 2, both the in-text citation and reference-list line "Not found" with prompting question |
| plain-text.txt | No flag | Inserted normally, no highlight, counter 0 |
| partial-support.txt | Found; support depends on keyQuote | Yellow highlight, "Found", support "not checked" (keyQuote empty) |

**Issue found:** with starter weights, "contains citation" (+3) alone reached the threshold, so every paste with a citation was flagged and the risk score wasn't selective. → led to spec 02.

---

## Stage 2 – Selective interruption and design changes (spec 02)

*Run by Claude Code: simulated pastes in headless Chrome; real keystrokes and clicks via Chrome DevTools protocol for the boundary fix. keyQuotes still empty.*

| # | Input | Expected | Actual | Pass |
|---|---|---|---|---|
| 1 | Real ref, accurate claim | Found; supported once quote added | Found, support unknown, score 0, quiet | ✅ |
| 2 | Real ref, overstated narrative claim | Found; partial/not supported once quote added | Narrative citation detected, found, unknown, quiet | ✅ |
| 3 | Real ref, unrelated claim | Found; not supported once quote added | Found, unknown, quiet | ✅ |
| 4 | Fake ref | Not found, pop-up | Not found, score 3, pop-up opens | ✅ |
| 5 | Fake reference-list line | Not found | Not found (title fallback found nothing), pop-up | ✅ |
| 6 | Plain text | No highlight | Nothing highlighted | ✅ |
| 7 | Three citations in one bracket | 2 found, 1 not found | Skitka and Bansal found (score 1, quiet); Morrison & Lee not found (score 4, pop-up) | ✅ |
| 8 | Impossible year | Not found, year signal | Not found +3, year +2 = 5, pop-up | ✅ |
| 9 | Page number | Found | Found, quiet | ✅ |
| 10 | Surname prefix | Detected, not found | "van der Berg" detected, not found, pop-up | ✅ |

**Boundary tests (change 4):** typing after verified and unverified highlights, at the start of a highlight, straight after a paste, after Edit, and Enter then typing – all kept new text outside the highlight.

**Bugs caught during this stage:** Enter at the end of a highlight still put the next character inside it (fixed in `a891bad`); the claim for the last citation in a multi-citation bracket kept a leftover "(…; )" (fixed in `a6aac44`).

---

## Stage 3 – Stemming and weight changes (spec 03, items 1–3)

*Run by me.*

- Stemming: makes/make, reduces/reduce, process/processes now match.
- All 10 test cases gave the same results as stage 2.
- Three reference-list lines with a real title but wrong authors or year: score 0 (quiet) → score 3 (pop-up).
- A partial match now opens the pop-up.

---

## Stage 4 – Real keyQuotes (spec 03, item 4)

*Run by me: Ctrl+V in Chrome.*

| # | Input | Expected | Actual | Pass |
|---|---|---|---|---|
| 1 | Real ref, accurate claim | Found, supported | Found, **partial**, pop-up opened | ❌ false alarm |
| 2 | Real ref, overstated claim | Partial / not supported, pop-up | [fill in] | |
| 3 | Real ref, unrelated claim | Not supported, pop-up | [fill in] | |
| 4–10 | | as stage 2 | [fill in] | |

**Issue found:** the accurate claim in test 1 scored partial because matching is word-based (people/humans, accepted/accept, correct/correctness, whether or not/regardless of). With partial weighted 3, nearly every real citation opened the pop-up, so interruption was no longer selective. → led to spec 03, item 5.

---

## Stage 5 – Final, after interruption fix and typo decision (spec 03, items 5–6; commits `7ce0962`, `4de75d9`)

*Expected results below were predicted by running the code's own logic (detector.js + lookup.js) outside the browser. Run by me: Ctrl+V in Chrome on the submitted version, to confirm what the interface actually does.*

Levels: **problem** = strong highlight + pop-up opens · **likely supported** = soft green underline, no pop-up · **quiet** = neutral underline, question on click.

| # | Input | Expected (lookup · support · score → level) | Actual in browser | Pass |
|---|---|---|---|---|
| 1 | Real ref, accurate paraphrase (Bansal) | found · partial · 2 → quiet; question on click | Found, partly supported; "Does it actually say this, or is this your interpretation?"; no pop-up on paste, question shown on click | ✅ |
| 2 | Real ref, overstated narrative claim | found · not supported · 3 → problem | Found, matched Bansal et al. (CHI 2021); quote does not match; "Which part of the paper are you relying on?" | ✅ |
| 3 | Real ref, unrelated claim (Skitka) | found · not supported · 3 → problem | Found, matched Skitka et al.; quote does not match; "Which part of the paper…?" | ✅ |
| 4 | Fake ref | not found · 3 → problem | Not found in the local reference list (simulated) | ✅ |
| 5 | Fake reference-list line | not found · 3 → problem | Not found; "Where did it come from – did you open the source yourself?" | ✅ |
| 6 | Plain text | no citations, nothing highlighted | No highlight | ✅ |
| 7 | Three citations in one bracket | all three → problem (Skitka and Bansal: not supported, 4; Morrison & Lee: not found, 4) | "Possible problem"; Skitka found, quote does not match, "Which part…?"; Bansal and Morrison & Lee also highlighted as problems | ✅ |
| 8 | Impossible year | not found + year · 5 → problem | Not found; "Where did it come from…?" | ✅ |
| 9 | Page number (Skitka) | detected incl. page · found · not supported · 3 → problem (false alarm: accurate claim, different words) | Found, matched Skitka et al.; quote does not match; "Which part…?" | ✅ (behaves as predicted; false alarm) |
| 10 | Surname prefix | "van der Berg" · not found · 3 → problem | "Possible problem"; (van der Berg, 2024) not found; "Where did it come from…?" | ✅ |
| 11 | Misspelled author (Bansel) | not found · 3 → problem | Not found; "Where did it come from…?" | ✅ |
| 12 | Real ref, claim close to source wording (Bansal) | found · supported · 0 → likely supported | Light green highlight, no pop-up | ✅ |
| 13 | Real ref, claim close to source wording (Buçinca) | found · supported · 0 → likely supported | "Likely supported", light green highlight | ✅ |
| 14 | Real title, wrong authors and year | found by title only · 3 → problem, "Matched by title only" note | Found, matched Bansal et al. (CHI 2021); "Matched by title only – the authors or year you gave differ…"; support not checked | ✅ |


**Findings to note:**
- Test 1 is now quiet by design (partial = 2), so its question only appears on click.
- Test 7's old expected result in `samples/test-cases.txt` ("found, quiet") is out of date: with real keyQuotes, "well documented" doesn't match either stored sentence, so all three now interrupt.
- Test 9 is a false alarm: an accurate claim about Skitka et al. scores *not supported* because it uses different words from the stored sentence. Same cause as the test 1 finding: word-based matching (limitation; semantic matching planned).
