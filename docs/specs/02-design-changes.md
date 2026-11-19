# Spec 02 – Design changes after first testing

> **Authorship:** design decisions mine, made after testing the scaffold. For some, Claude (claude.ai) suggested options and I chose between them. I gave Claude Code a written specification of these changes (drafted with Claude), and Claude Code implemented and tested them.
> **Resulting commits (17 Nov, 20:38–20:49):** `e987e3f` to `41f1de7` (10 commits)
> **Date:** 17 Nov 2026

## What I found in the scaffold
- Every citation reached the risk threshold, so every paste was flagged. The design wasn't selective.
- After verifying a citation and clicking back into the editor, new typing went inside the old highlight.
- Verified and dismissed citations stayed highlighted, which cluttered the text.
- Only bracketed "(Name, Year)" citations were detected, not narrative ones like "Smith et al. (2021) found…".

## Decisions

| # | Decision | Why | Commit |
|---|---|---|---|
| 1 | **Selective interruption:** run the lookup and support check first, then score the *results*. Only a problem opens the pop-up; "likely supported" gets a soft green underline; anything else stays quiet until clicked | Flagging everything isn't selective. Checking helps when it's cheap (Vasconcelos et al., 2023); interruptions should fit the context (Amershi et al., 2019) | `e987e3f`, `d86759c` |
| 2 | **"Likely supported" styled differently from verified**, and still counted as unverified | A green "this is fine" signal could increase trust without checking (Bansal et al., 2021) | `d86759c` |
| 3 | **Remove highlights once verified or dismissed**; Undo after Dismiss restores it | Fixes the typing bug; highlights should only mark what still needs action (Norman, 2013) | `08f3f47` |
| 4 | **Session history panel** with Unverified / Verified / Dismissed counts | Once highlights disappear, the student still needs a record of what they checked | `c275e4f` |
| 5 | **Keep typing at a highlight's edge outside it**; drop the zero-width space | My first idea was a normal space, but that edits the student's text and doesn't fix the cause | `a891bad` |
| 6 | **Detect narrative citations, page numbers and surname prefixes**; title fallback for reference-list lines | AI-generated text often uses narrative citations | `a6aac44`, `266db69` |
| 7 | **Simple stemming** in the support check | So singular and plural forms match | `13ba15a` (later fixed, see spec 03) |
| 8 | **10 test cases** with expected results | To check each change against the same inputs | `41f1de7` |

## Checks
See `test-results.md`, stage 2.
