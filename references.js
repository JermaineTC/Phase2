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
 * These are real papers. No abstracts or quotes have been filled in on purpose.
 */
const REFERENCES = [
  {
    authors: ["Skitka", "Mosier", "Burdick"],
    year: 1999,
    title: "Does automation bias decision-making?",
    venue: "International Journal of Human-Computer Studies",
    keyQuote: "" // TODO(me): paste a real sentence from the paper's abstract
  },
  {
    authors: ["Bansal"], // et al.
    year: 2021,
    title: "Does the whole exceed its parts? The effect of AI explanations on complementary team performance",
    venue: "CHI 2021",
    keyQuote: "" // TODO(me): paste a real sentence from the paper's abstract
  },
  {
    authors: ["Buçinca", "Malaya", "Gajos"],
    year: 2021,
    title: "To trust or to think: Cognitive forcing functions can reduce overreliance on AI in AI-assisted decision-making",
    venue: "PACM HCI CSCW",
    keyQuote: "" // TODO(me): paste a real sentence from the paper's abstract
  },
  {
    authors: ["Vasconcelos"], // et al.
    year: 2023,
    title: "Explanations can reduce overreliance on AI systems during decision-making",
    venue: "PACM HCI CSCW",
    keyQuote: "" // TODO(me): paste a real sentence from the paper's abstract
  },
  {
    authors: ["Kim"], // et al.
    year: 2024,
    title: "\"I'm not sure, but...\": Examining the impact of large language models' uncertainty expression on user reliance and trust",
    venue: "FAccT 2024",
    keyQuote: "" // TODO(me): paste a real sentence from the paper's abstract
  },
  {
    authors: ["Liu", "Zhang", "Liang"],
    year: 2023,
    title: "Evaluating verifiability in generative search engines",
    venue: "Findings of EMNLP 2023",
    keyQuote: "" // TODO(me): paste a real sentence from the paper's abstract
  },
  {
    authors: ["Ji"], // et al.
    year: 2023,
    title: "Survey of hallucination in natural language generation",
    venue: "ACM Computing Surveys",
    keyQuote: "" // TODO(me): paste a real sentence from the paper's abstract
  },
  {
    authors: ["Amershi"], // et al.
    year: 2019,
    title: "Guidelines for human-AI interaction",
    venue: "CHI 2019",
    keyQuote: "" // TODO(me): paste a real sentence from the paper's abstract
  }
];
