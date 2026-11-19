## Design rationale and project explanation

My A1 review found that citations in LLM answers raise trust without lowering the cost of checking them (Ding et al., 2025; Vasconcelos et al., 2023). A1 feedback noted that some sections read as separate summaries, so here each choice draws on several sources together. The design has also changed since A1, which proposed prompting at every reuse: testing showed this was not selective (section 3). The aim is to make verification cheaper than trust without interrupting so often that warnings are ignored.

### 1. Checking at the point of reuse (implemented)

The flow is paste → detect → lookup → support check → pop-up with Verify, Edit and Dismiss. Paste is where an unsupported claim moves from the AI's answer into work the student is accountable for. In Norman's (2013) terms, a numbered citation leaves the gulf of evaluation wide, because the student must open and search the source to learn what it says. The pop-up narrows that gulf by bringing the result into the document. A `contenteditable` editor lets the pop-up sit beside the pasted text. The prototype handles author-year citations only: AI tools mostly use numbered ones, but coursework uses author-year styles, which is the form a claim takes once it enters graded work. Numbered citations are planned.

### 2. Showing the quote, not just the citation (implemented on simulated data)

Each paper has a `keyQuote`: one sentence copied word for word from its abstract. The support check compares the claim with this sentence, and the pop-up shows it beside the claim. Vasconcelos et al. (2023) found that explanations reduced over-reliance only when they made verifying cheaper than trusting, while Bansal et al. (2021) found that other explanations simply raised acceptance. A numbered citation resembles Bansal's case: it looks like evidence but requires searching a whole source. Showing one sentence supports recognition rather than recall. The quote is copied exactly because a paraphrase would itself be generated text (Ji et al., 2023).

This is the main scope compromise. I chose each sentence by hand, whereas a real system must retrieve the relevant passage, which is the harder problem. Tests confirmed the cost: only claims worded almost exactly like the stored sentence scored "supported" (tests 12 and 13), and both accurate paraphrases failed (tests 1 and 9). In practice, "likely supported" means "nearly copied word for word".

### 3. Selective interruption through a risk score (implemented)

The risk score adds weighted signals from the lookup and support check and sets one of three levels. Clear problems (not found, title-only match, not supported, each +3) reach the threshold of 3 and open the pop-up. Likely supported citations get a soft green underline. Everything else stays quiet, with a neutral underline and a question on click. In the first build every citation reached the threshold, so nothing was selective. Repeated false alarms weaken responses to later warnings (Breznitz, 1984), and Amershi et al. (2019) recommend timing services based on context (G3).

The threshold is a signal detection criterion: raising it reduces false alarms but increases misses. A partial match scores 2, so on its own it stays quiet. However, paste-level signals (+1 for several citations, +1 for over 300 characters) can lift it to 3. A typical AI paragraph is long, so partial matches will often interrupt in real use. I accepted this, because a long, multi-source paste carries more risk, but it makes the design less selective than short tests suggest. The green underline still counts as unverified: a "fine" signal could raise trust without checking (Bansal et al., 2021; Ding et al., 2025), so only the student's action marks a claim verified.

I used rules rather than a trained model because every signal can be listed to the student (G11) and the prototype needs no API key. Regex suits detection because citation styles follow fixed patterns, and keyword overlap is simple enough to explain in one line under "Why was this flagged?". The 60% and 30% overlap cut-offs are starting values I adjusted against the test cases, not empirically derived.

### 4. Pop-up controls and prompting questions (implemented)

The pop-up offers Verify, Edit, Dismiss (undoable for six seconds), a prompting question and "Why was this flagged?", listing each signal and the score. These follow Amershi et al.'s guidelines for when the system is wrong: efficient dismissal (G8), efficient correction (G9) and explaining its actions (G11). A note in every pop-up supports G1 and G2: the check is simulated, and "not found" does not prove a reference fake. Luger and Sellen (2016) showed that a gap between expected and real capability leads users to work around a system. The question is a light cognitive forcing function; Buçinca et al. (2021) found these reduce over-reliance but are disliked, so it appears only when a problem is detected or the student asks. One risk remains: Verify is one click away, even from a green "matches" result, and does not check that the source was opened, so a student could rubber-stamp the system's judgement, the over-reliance the design aims to reduce.

### 5. No typo tolerance (implemented)

Author matching is exact, ignoring only case and accents. If "Bansel (2021)" matched Bansal silently, the error would pass into the final work, and few citations are ever checked (Ding et al., 2025). Hallucinated references can look almost identical to real ones (Ji et al., 2023). The cost is more false alarms for genuine typos, against section 3. A better option, suggesting "Did you mean Bansal (2021)?", would keep exact matching while making correction quick (G9); this is planned.

### 6. Session history panel (implemented, session only)

Verified and dismissed citations return to plain text, so highlights mark only what still needs action. A history panel shows Unverified, Verified and Dismissed counts and a clickable list. This keeps knowledge in the world rather than in the head (Norman, 2013) and follows G12 (remember recent interactions). Saving across reloads is planned.

### Limitations and planned features

The paste is inserted by code, so Ctrl+Z does not undo it; pasting the wrong text is a slip, and the remedy for slips is undo, so native undo is planned. Matching compares wording, not meaning (section 2), so a claim reusing the quote's words but changing its meaning could pass, the false reassurance I noted in A1. Planned: semantic matching, a "this looks wrong" report button, and re-checking after Edit. The system checks only factual claims with a source, not opinion or synthesis.
