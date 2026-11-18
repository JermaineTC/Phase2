/*
 * references.js – the small LOCAL reference list used by the simulated lookup.
 *
 * Each entry:
 *   authors:  array of surnames. For "et al." papers only the FIRST author is
 *             listed; lookup.js matches on the first author + year.
 *   year:     publication year (number)
 *   title:    paper title
 *   venue:    where it was published
 *   keyQuote: one real sentence from the paper's abstract, used by the
 *             keyword-overlap support check. While it is empty, the
 *             support check returns "unknown".
 *
 * These are real papers. Each keyQuote is copied word for word from the
 * paper's abstract. Double quotes inside a quote must be written as \"
 * (otherwise they end the string early and the whole file stops working).
 */
const REFERENCES = [
  {
    authors: ["Skitka", "Mosier", "Burdick"],
    year: 1999,
    title: "Does automation bias decision-making?",
    venue: "International Journal of Human-Computer Studies",
    keyQuote: "Participants with an aid made errors of omission (missed events when not explicitly prompted about them by the aid) and commission (did what an automated aid recommended, even when it contradicted their training and other 100% valid and available indicators)" 
  },
  {
    authors: ["Bansal"], // et al.
    year: 2021,
    title: "Does the whole exceed its parts? The effect of AI explanations on complementary team performance",
    venue: "CHI 2021",
    keyQuote: "Rather, explanations increased the chance that humans will accept the AI’s recommendation, regardless of its correctness." 
  },
  {
    authors: ["Buçinca", "Malaya", "Gajos"],
    year: 2021,
    title: "To trust or to think: Cognitive forcing functions can reduce overreliance on AI in AI-assisted decision-making",
    venue: "PACM HCI CSCW",
    keyQuote: "The results demonstrate that cognitive forcing significantly reduced overreliance compared to the simple explainable AI approaches" 
  },
  {
    authors: ["Vasconcelos"], // et al.
    year: 2023,
    title: "Explanations can reduce overreliance on AI systems during decision-making",
    venue: "PACM HCI CSCW",
    keyQuote: "By contrast, our paper argues that people strategically choose whether or not to engage with an AI explanation, demonstrating empirically that there are scenarios where AI explanations reduce overreliance." 
  },
  {
    authors: ["Kim"], // et al.
    year: 2024,
    title: "\"I'm not sure, but...\": Examining the impact of large language models' uncertainty expression on user reliance and trust",
    venue: "FAccT 2024",
    keyQuote: "We find that first-person expressions (e.g., \"I'm not sure, but...\") decrease participants' confidence in the system and tendency to agree with the system's answers, while increasing participants' accuracy." 
  },
  {
    authors: ["Liu", "Zhang", "Liang"],
    year: 2023,
    title: "Evaluating verifiability in generative search engines",
    venue: "Findings of EMNLP 2023",
    keyQuote: "We find that responses from existing generative search engines are fluent and appear informative, but frequently contain unsupported statements and inaccurate citations: on average, a mere 51.5% of generated sentences are fully supported by citations and only 74.5% of citations support their associated sentence" 
  },
  {
    authors: ["Ji"], // et al.
    year: 2023,
    title: "Survey of hallucination in natural language generation",
    venue: "ACM Computing Surveys",
    keyQuote: "In this survey, we thus provide a broad overview of the research progress and challenges in the hallucination problem in NLG." 
  },
  {
    authors: ["Amershi"], // et al.
    year: 2019,
    title: "Guidelines for human-AI interaction",
    venue: "CHI 2019",
    keyQuote: "We propose 18 generally applicable design guidelines for human-AI interaction" 
  }
];
