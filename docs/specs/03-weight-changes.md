# Spec 03 – Weight and data changes after review

> **Authorship:** every decision in this spec was mine. Some problems I found myself, such as the over-interruption in section 5, which I found in my own testing before choosing between the options. Others were pointed out to me: Claude Code flagged the stemming problem (section 1), and Claude (claude.ai) suggested a corrected rule, which I chose to apply and then tested. I chose the keyQuotes and copied them from the published abstracts myself. All code changes were implemented through Claude Code, but it did not make any of the decisions.
> **Resulting commits (18 Nov, 18:46–19:53):** `17b4b1e` (stemming), `722e865` (partial → 3), `f4c2051` (matchedByTitle), `e5e7834` (keyQuotes), `7ce0962` (partial → 2), `4de75d9` (no typo tolerance), `c2ffd93` (weight reasoning documented in code)
> **Date:** 18 Nov 2026

## 1. Stemming rule (`17b4b1e`)
- **Problem:** the "strip es/s" rule turned "makes" into "mak" and "process" into "proces", so singular and plural forms stopped matching.
- **Decision:** strip "es" only after s/x/ch/sh, and keep words ending in "ss".
- **Check:** makes/make, reduces/reduce and process/processes now match.

## 2. Partial weight 2 → 3 (`722e865`)
- **Problem:** a partial match scored 2, under the threshold, so the prompting question ("Does it actually say this…?") never appeared on its own.
- **Decision:** raise `partial` to 3.
- **Check:** a partial match now opens the pop-up (`test-results.md`, stage 3). This was later reversed in section 5.

## 3. New signal: matchedByTitle +3 (`f4c2051`)
- **Problem:** a reference-list line with a real title but invented authors or year scored 0 and stayed quiet, which is exactly the kind of fabricated reference the system is meant to catch.
- **Decision:** add `matchedByTitle: +3`.
- **Check:** three reference-list lines with a real title but wrong authors or year went from score 0 (quiet) to score 3 (pop-up) (`test-results.md`, stage 3; later test 14).

## 4. Real keyQuotes (`e5e7834`)
- **Problem:** the keyQuotes were empty, so the support check always returned "unknown".
- **Decision:** one sentence per paper, the one stating the main finding, copied word for word from the published abstract.
- **Check:** each sentence compared with its source page.

## 5. Interruption fix after adding keyQuotes (`7ce0962`)
- **Problem found in my own testing:** with real keyQuotes, an accurate paraphrase of Bansal et al. scored *partial* (people/humans, accepted/accept, whether or not/regardless). With partial at 3, nearly every real citation opened the pop-up, so interruption was no longer selective.
- **Options considered:** (A) partial back to 2, so only clear problems interrupt; (B) store more source text per paper; (C) loosen the support threshold.
- **Decision:** option A, `partial` back to 2. Clear problems (not found, title-only match, not supported) still reach the threshold and open the pop-up; a partial match gets an underline, and its question appears when clicked. The strength of the interruption now matches how serious the problem is. I chose this because it keeps the interruption selective: if the pop-up keeps opening when a citation is correct, students may find it easier to just dismiss it, which is the cry-wolf effect.
- **Check:** `test-results.md`, stage 5: test 1 is quiet with the question on click; tests 2–5 and 7–11 still open the pop-up.

## 6. No typo tolerance in the lookup (`4de75d9`)
- **Decision:** author matching becomes exact, ignoring only case and accents. A misspelled author such as "Bansel (2021)" now counts as *not found*.
- **Why:** an earlier version allowed small typos, but I changed this so students actively check their work when something looks like an error. If the misspelling were allowed through, it could end up in their final work.
- **Check:** test 11: pasted "(Bansel et al., 2021)" → not found, pop-up opened.
