<!--
BEFORE SUBMITTING (hidden on GitHub):
[ ] Enable GitHub Pages and check the live link works
[x] Add docs/system-diagram.png and docs/storyboards/
[ ] Fill the [brackets] – they mark things only you know
[ ] Count prose words (exclude code, commands, tables) and fill in [X]
[ ] Tag v1.0-a2 after the final commit
-->

# Selective citation checking at the point of reuse

**IIS Assignment 2** · README word count: 1,538 (code, commands and tables excluded)
**Submitted version:** release [`v1.0-a2`](https://github.com/JermaineTC/Phase2/releases/tag/v1.0-a2)
**Live version:** https://jermainetc.github.io/Phase2/

A browser-based writing editor that checks citations when a student pastes AI-generated text into their work. For each citation it checks whether the reference exists and whether the source supports the claim, then only interrupts when something looks wrong. The design reasoning is in the report; this README covers what was built, how to run it, and how it developed.

---

## Project status

| Feature | Status |
|---|---|
| Paste detection in a `contenteditable` editor | Implemented |
| Citation detection: bracketed (incl. "&"/"and", et al., several per bracket), narrative, page numbers, surname prefixes, reference-list lines | Implemented |
| Risk score that sets the interruption level: **problem** (pop-up opens), **likely supported** (soft green underline), **quiet** (question on click) | Implemented |
| Reference existence check against 8 real references, with title-keyword fallback | **Simulated** (local list, no live database) |
| Claim–support check: keyword overlap with one sentence from each paper's abstract | Implemented logic on **simulated** source data |
| Pop-up with Verify / Edit / Dismiss, Undo, prompting questions and "Why was this flagged?" | Implemented |
| Stored key quote shown in the pop-up under the support result | Implemented |
| Highlights removed once verified or dismissed | Implemented |
| Session history panel with Unverified / Verified / Dismissed counts | Implemented (session only) |
| Live reference lookup (e.g. CrossRef) | Planned |
| Semantic or LLM-based claim–support matching | Planned |
| Re-checking a citation after it is edited | Planned |
| Saving history and document across reloads | Planned |
| Numbered citations, e.g. `[1]` | Planned |

**Known limitations**
- Support matching compares words, not meaning. Accurate paraphrases can score *partial* or *not supported* (tests 1 and 9 in `test-results.md`). The system errs towards asking rather than reassuring.
- Any capitalised word before "(year)" is treated as a narrative citation, e.g. "Microsoft (2023)".
- Only one stored sentence per paper; two papers by the same first author in the same year aren't told apart.
- Verify records the student's judgement; it doesn't check they opened the source.
- Once verified or dismissed, a citation's pop-up can't be reopened.
- Ctrl+Z doesn't undo pastes handled by the code.
- Tested in Chrome only.

## Technology stack

- **HTML, CSS, vanilla JavaScript:** no frameworks, build tools or backend, so it runs by opening one file.
- **`contenteditable` editor:** chosen over a `<textarea>` so citations can be highlighted and the pop-up anchored next to them.
- **Regex detection and weighted risk score** (`detector.js`): weights and threshold in `DETECTOR_CONFIG`, with comments explaining how they were tuned.
- **Simulated lookup and keyword-overlap support check** (`lookup.js`, `references.js`): thresholds in `LOOKUP_CONFIG`.
- **AI tools used in development:** Claude (claude.ai) and Claude Code. See [AI assistance](#ai-assistance).
- **Undecided:** which live reference API and which matching approach to use for the planned version.

## Running or inspecting the work

**Option 1:** open the [live version](https://jermainetc.github.io/Phase2/).

**Option 2:** run it locally (no installs or API keys):
```
git clone https://github.com/JermaineTC/Phase2.git
```
Then double-click `index.html`.

**To try it:** copy one block at a time from `samples/test-cases.txt` and paste it into the editor. Good starting points:
- **Test 4**, fabricated reference: the pop-up opens with "Where did it come from?"
- **Test 2**, real reference with an overstated claim: the pop-up opens with "Which part of the paper are you relying on?"
- **Test 1**, accurate paraphrase scored *partial*: neutral underline, and the question appears when clicked
- **Test 12**, claim close to the source: soft green "likely supported" underline, no pop-up
- **Test 6**, plain text: no interruption

Press F12 and type `eventLog` in the console to see the Verify, Edit, Dismiss and Undo actions in the session.

| File | Purpose |
|---|---|
| `index.html`, `style.css` | Layout, highlight colours, pop-up and history panel |
| `app.js` | Paste handling, highlights, pop-up, buttons, history |
| `detector.js` | Citation detection, risk score, interruption level |
| `lookup.js` | Simulated existence check, title fallback, support check |
| `references.js` | 8 real references, each with one sentence from its abstract |
| `prompts.js` | All pop-up wording and prompting questions |
| `samples/test-cases.txt` | Test inputs with expected results |
| `test-results.md` | Expected vs actual results at each stage of development |

## Development record

Each entry gives the change, why it was made, how it was checked and who did what. All commits: [commit history](https://github.com/JermaineTC/Phase2/commits/main). The specifications I gave Claude Code are in [`docs/specs/`](docs/specs/): [spec 01](docs/specs/01-scaffold.md) (entry 1), [spec 02](docs/specs/02-design-changes.md) (entries 2–5) and [spec 03](docs/specs/03-weight-changes.md) (entries 6–10).

Build period: 17 Nov 17:23 to 18 Nov 19:53. Later commits are documentation and two UI changes made after review (entries 11 and 12).

**1. First build** (first 7 commits, `bb35d8e` to `8c93909`)
- **Change:** paste → detect → simulated lookup → support check → pop-up with Verify / Edit / Dismiss.
- **Why:** this is the core of my A1 proposal: prompt checking at the moment of reuse. I chose `contenteditable` because the pop-up needs to sit next to the pasted text, and a simulated lookup so it runs without API keys.
- **Checked:** stage 1 in `test-results.md`.

**2. Selective interruption** (`e987e3f`, `d86759c`)
- **Change:** the risk score now scores the *results* of the lookup and support check. Only problems open the pop-up; "likely supported" gets a soft green underline, styled differently from verified.
- **Why:** in the first build every citation reached the threshold, so the design wasn't selective. Checking helps when it's cheap (Vasconcelos et al., 2023) and interruptions should fit the context (Amershi et al., 2019). A green "fine" signal could increase trust without checking (Bansal et al., 2021), so it still counts as unverified.
- **Checked:** stage 2 in `test-results.md`.

**3. Remove resolved highlights and fix the highlight boundary** (`08f3f47`, `a891bad`)
- **Change:** verified and dismissed citations go back to plain text. Typing at a highlight's edge stays outside it.
- **Why:** while testing, I found that after verifying, new typing went inside the old highlight. My first idea was adding a space, but that edits the student's text and doesn't fix the cause. Removing resolved highlights also means highlights only mark what still needs action.
- **Checked:** typing after verified and unverified highlights stays plain.

**4. Session history panel** (`c275e4f`)
- **Change:** Unverified / Verified / Dismissed counts and a clickable list of citations.
- **Why:** once resolved highlights disappear, the student still needs a record of what they checked or dismissed.
- **Checked:** verified and dismissed a citation; the counts and list updated.

**5. More citation formats** (`a6aac44`, `266db69`, fix `b0c573d`)
- **Change:** narrative citations ("Smith et al. (2021) found…"), page numbers, surname prefixes, and title matching for reference-list lines.
- **Why:** the first build missed narrative citations, which AI-generated text often uses.
- **Checked:** tests 2, 9, 10 and 14 in `test-results.md`.

**6. Stemming fix** (`13ba15a`, then `17b4b1e`)
- **Change:** "es" is now stripped only after s/x/ch/sh, and words ending in "ss" are kept.
- **Why:** the first rule turned "process" into "proces", so singular and plural forms stopped matching.
- **Checked:** I tested makes/make, reduces/reduce and process/processes.

**7. Catching fabricated references more reliably** (`722e865`, `f4c2051`)
- **Change:** new signal `matchedByTitle: +3`, so a real title with invented authors or year opens the pop-up.
- **Why:** before this, such a reference scored 0 and stayed quiet, which is exactly the case the design should catch.
- **Checked:** test 14 in `test-results.md`.

**8. Real source data** (`e5e7834`)
- **Change:** each paper's `keyQuote` is now one sentence copied word for word from its published abstract.
- **Why:** without it, the support check always returned "unknown" and only half the system worked.
- **Checked:** compared each sentence with its source page.

**9. Matching interruption strength to the problem** (`722e865`, then `7ce0962`)
- **Change:** `partial` was raised to 3, then lowered back to 2.
- **Why:** raising it made partial matches open the prompting question. But with real quotes, accurate paraphrases also scored partial (test 1: "people" vs "humans", "accepted" vs "accept"), so nearly every real citation opened the pop-up. I chose to put it back at 2: clear problems (not found, title-only match, not supported) interrupt, while a partial match gets an underline and its question on click. I chose this because it keeps the interruption selective: if the pop-up keeps opening when a citation is correct, students may find it easier to just dismiss it, which is the cry-wolf effect. The trade-off is that a weak problem is sometimes missed, and a partial match in a long or multi-citation paste still reaches 3 and opens the pop-up.
- **Checked:** stage 5 in `test-results.md`: test 1 is quiet with the question on click; tests 2–5 and 7–11 still open the pop-up.

**10. No typo tolerance** (`4de75d9`, documented in `c2ffd93`)
- **Change:** author matching is exact, ignoring only case and accents.
- **Why:** an earlier version allowed small typos, but I changed this so students actively check their work when something looks like an error. If "Bansel (2021)" counted as found, the typo could end up in their final work, and Ding et al. (2025) found that only around 10% of citations are ever checked.
- **Checked:** test 11 in `test-results.md`.

**11. Showing the key quote in the pop-up** (`0eb7988`)
- **Change:** the pop-up shows the paper's stored `keyQuote` under the support result.
- **Why:** this is the main idea of my A1 contribution. Before, the system compared the claim with the quote but only showed its verdict. Showing the sentence lets the student compare the claim with the paper's own words, which makes checking cheaper (Vasconcelos et al., 2023).
- **Checked:** pasted tests 2 and 12 in Chrome; the quote appears under the result.

**12. Wording for unflagged citations** (`13da7be`)
- **Change:** the explanation section is headed "Why was this flagged?" only for problems; for the other levels it says "How was this scored?".
- **Why:** review feedback pointed out that a citation with score 0 was labelled as "flagged", which contradicts the selective design.
- **Checked:** test 12 shows "How was this scored?", test 4 shows "Why was this flagged?".

**Changes since A1**
- A1 listed paraphrased or partly supported claims as a limitation. The system now detects partial matches and asks a prompting question instead.
- A1 proposed prompting at every reuse. Development moved this to selective interruption, after testing showed that flagging everything isn't selective.

## AI assistance

- **Tools:** Claude (claude.ai) for planning, suggesting design options and drafting the specifications I gave Claude Code; Claude Code for implementing and testing those specifications.
- **Who did what:** design decisions are mine. For some, Claude suggested options and I chose between them. Claude Code wrote most of the code from my specifications. I chose and checked the source quotes, ran the final tests, and made the last weight and matching decisions. No code was reused from other projects.
- **Report, README, storyboards and diagram:** Claude helped draft the report's design rationale and abstract from my notes, my A1 review and the code, and drafted this README from my development notes and commit history. I checked each claim against the code and `test-results.md`, corrected the ones that were wrong (for example, saving across reloads is planned, not built), and rewrote entries 9 and 10 from my own notes. Claude drew the final storyboards from my storyboard plan; I checked every screen against `prompts.js` and `app.js` and asked for changes where they did not match. I drew the system diagram in Excalidraw and revised it after reviewing it with Claude.
- **Example 1, a problem I found myself:** while testing, I noticed new typing going inside verified highlights. I asked for the cause to be fixed rather than worked around, and retested by typing after verified and unverified highlights.
- **Example 2, reviewed and kept:** Claude Code added a "Why was this flagged?" section I hadn't asked for. I kept it because it shows the student why the system acted (Amershi et al., 2019).
- **Example 3, flagged by AI, decided by me:** Claude Code pointed out that its stemming rule broke matches. Claude supplied a corrected rule; I applied it and tested the word pairs myself.

## Additional files

| File | Purpose |
|---|---|
| [`docs/abstract.md`](docs/abstract.md) | Report abstract |
| [`docs/design-rationale.md`](docs/design-rationale.md) | Report design rationale and project explanation |
| [`docs/references.md`](docs/references.md) | Reference list for the report and README |
| [`docs/system-diagram.png`](docs/system-diagram.png) | System diagram |
| [`docs/specs/`](docs/specs/) | The three specifications I gave Claude Code, with the decisions and resulting commits |
| [`docs/storyboards/`](docs/storyboards/) | Three storyboards: paraphrased citation, fabricated reference, false alarm |
| `samples/fake-reference.txt`, `samples/partial-support.txt`, `samples/plain-text.txt` | Early test inputs, used in stage 1 of `test-results.md` |
