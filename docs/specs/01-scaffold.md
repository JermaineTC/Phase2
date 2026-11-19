# Spec 01 – Scaffold

> **Authorship:** design decisions mine (from my A1 proposal and the A2 plan). I gave Claude Code a written specification (drafted with Claude, claude.ai), and Claude Code implemented it.
> **Resulting commits (17 Nov, 17:23–17:28):** `bb35d8e` to `8c93909`, the first 7 commits on `main`
> **Date:** 17 Nov 2026

## Decisions

| Decision | Why |
|---|---|
| **Trigger on paste**, not while typing | My A1 gap: prompt verification at the moment of reuse, not all the time |
| **Two checks per citation:** does the reference exist, and does the source support the claim | Fabricated references and real references attached to the wrong claim are both problems (Liu et al., 2023) |
| **Inline pop-up next to the pasted text**, with Verify / Edit / Dismiss | The student stays in control and can dismiss quickly (Amershi et al., 2019) |
| **Prompting question** when a reference isn't found or only partly matches | A light version of cognitive forcing (Buçinca et al., 2021), kept optional because heavy forcing was disliked |
| **Simulated lookup** against a local list of 8 real references, labelled as simulated in the UI | No API keys, runs offline, and is honest about what is real |
| **Keyword-overlap support check** against one stored sentence per paper | Simple enough to build and explain; semantic matching planned |
| **Vanilla HTML/CSS/JS, `contenteditable` editor, opens from `index.html`** | Anyone can run it without installing anything; `contenteditable` allows highlights and an anchored pop-up |
| **Never block the paste** | The system advises; the student decides |

## Checks
Claude Code tested the scaffold with simulated pastes in headless Chrome. See `test-results.md`, stage 1.
