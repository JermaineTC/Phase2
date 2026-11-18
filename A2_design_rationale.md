## Design rationale and project explanation

My A1 review found that citations in LLM answers raise trust without lowering the cost of checking them (Ding et al., 2025; Vasconcelos et al., 2023). The system responds to this at the moment a student reuses AI output. When text is pasted into the editor, it detects each citation, runs a simulated lookup, checks whether a stored sentence from the paper supports the claim, and decides how strongly to ask the student to check. The aim is to make verification cheaper than trust, without interrupting so often that students stop reading the warnings.

### 1. Checking at the point of reuse

The core flow is paste → detect → lookup → support check → pop-up with Verify, Edit and Dismiss. I placed the check at paste because this is where an unsupported claim moves from the AI's answer into work the student is accountable for. In Norman's (2013) terms, a numbered citation leaves the gulf of evaluation wide, because the student must open and search the source to find out what it says. The pop-up narrows that gulf by bringing the result of the check into the document. I used a `contenteditable` editor so the pop-up sits next to the pasted text rather than in a separate panel, keeping the evidence inside the student's current task (selective attention, Week 2). The lookup is simulated so the prototype runs without API keys; a real database lookup is planned.

### 2. Showing the quote, not just the citation

Each paper in the corpus has a `keyQuote`: one sentence copied word for word from its published abstract. The support check compares the claim against this sentence, and the pop-up shows the sentence under the result, next to the claim. Vasconcelos et al. (2023) found that explanations reduced over-reliance only when they made verifying cheaper than trusting, while Bansal et al. (2021) found that explanations which did not do this simply raised acceptance. A numbered citation is closer to Bansal's case: it looks like evidence but asks the student to recall and search a whole source. Showing the sentence turns checking into recognition rather than recall: the student reads one quote instead of searching a paper. The quote is copied exactly because a paraphrase would itself be generated text (Ji et al., 2023).

### 3. Selective interruption through a risk score

The risk score is based on the results of the lookup and support check, and sets one of three levels. Clear problems (a paper not found, a match on title only, or a quote that does not support the claim) open the pop-up straight away. Likely supported citations get a soft green underline. Everything else stays quiet, with a neutral underline and a prompting question on click. In the first build every citation reached the threshold, so the design was not selective. Repeated false alarms reduce how people respond to later warnings (Breznitz, 1984), and Amershi et al. (2019) recommend timing services based on context (G3). If every citation triggered a pop-up, students would learn to dismiss it.

The threshold is a signal detection criterion. Raising it reduces false alarms but increases misses: a partial match currently scores 2, below the threshold, so its prompting question never appears on its own. I accepted this because a missed partial match costs less than students ignoring every warning. The green underline is styled differently from "verified" and still counts as unverified. A green "fine" signal could become another cue that raises trust without checking, the pattern Bansal et al. (2021) and Ding et al. (2025) both found, so only the student's own action marks a claim as verified.

### 4. Pop-up controls and prompting questions

The pop-up offers Verify, Edit and Dismiss, a prompting question ("Does it actually say this…?") and a "Why was this flagged?" section listing each signal and the total score. Dismiss can be undone for a few seconds. These follow Amershi et al.'s (2019) guidelines for when the system is wrong: efficient dismissal (G8), efficient correction (G9) and explaining why it acted (G11). A note at the top of every pop-up supports G1 and G2, making clear what the system can do and how well: the check is simulated, "not found" does not prove a reference is fake, and "found" does not prove it is correct. Luger and Sellen (2016) showed that a gap between expected and real capability leads users to work around a system. The prompting question acts as a light cognitive forcing function. Buçinca et al. (2021) found these reduce over-reliance but are disliked, so it appears only when a problem is detected or the student asks, not before every claim.

### 5. No typo tolerance

An earlier version allowed small spelling differences when matching author names. Matching is now exact, ignoring only case and accents. If "Bansel (2021)" is matched to Bansal silently, the error passes into the final work, and Ding et al. (2025) found that only around 10% of citations were ever checked. LLM generation has no "not found" branch, so a fabricated reference can look almost identical to a real one. The cost is more false alarms for genuine typos, which works against section 3. I judged this acceptable because a misspelled name is quick to correct.

### 6. Session history panel

Verified and dismissed citations go back to plain text, so highlights only mark what still needs action. A history panel keeps a record of what the student checked, showing Unverified, Verified and Dismissed counts and a clickable list of citations. This follows the guideline that the system should carry state rather than ask the person to remember it, and Amershi et al.'s G12 (remember recent interactions). The history currently lasts for the session only; saving the document and history across reloads, is planned.

### Limitations and planned features

The paste is handled by the code and inserted as plain text, so the browser's normal Ctrl+Z does not undo it. This reduces reversibility. Pasting the wrong text is a slip, and the remedy for slips is undo, so restoring native undo is planned. The support check also compares wording, not meaning. A claim that correctly paraphrases the quote can be flagged as unsupported, adding false alarms, while a claim that reuses the quote's words but changes what it says could pass. This could give false reassurance, as I noted in A1. A planned "this looks wrong" button would let students report these cases, since a citation should be reportable. Verify records the student's judgement but does not check that they opened the source, and editing a citation does not yet re-run the check (planned). Finally, the system only checks factual claims with a source, not opinion or synthesis.

## References (additions)

Amershi, S., Weld, D., Vorvoreanu, M., Fourney, A., Nushi, B., Collisson, P., Suh, J., Iqbal, S., Bennett, P. N., Inkpen, K., Teevan, J., Kikin-Gil, R., & Horvitz, E. (2019). Guidelines for human-AI interaction. In Proceedings of CHI 2019. ACM.

Breznitz, S. (1984). Cry wolf: The psychology of false alarms. Lawrence Erlbaum Associates.
