/**
 * The bibliography behind every health number FitMess shows.
 *
 * ## Why this file exists
 *
 * App Review rejected FitMess under **guideline 1.4.1 (Safety — Physical
 * Harm)** on 17.08.2026: *"The app provides health or medical calculations
 * without citations, such as links to sources for this information. All apps
 * with medical and health information should include citations… The citations
 * to the sources should be easy for the user to find."*
 *
 * The sources were never missing — they were in code comments. `engine.ts`
 * names Mifflin-St Jeor, `micro.ts` names the WHO and DGA limits,
 * `activities.ts` names the Compendium, `day-trust.ts` names Goldberg. Not one
 * of them was reachable by the person the numbers are actually shown to. This
 * file is that same bibliography moved to where a user (and a reviewer) can
 * read it, at `/izvori`.
 *
 * ## Rules for editing
 *
 * 1. **A number the UI shows must be traceable to an entry here.** If a new
 *    calculation lands without one, `/izvori` has quietly stopped being true
 *    and 1.4.1 is open again.
 * 2. **The citation is the record, the link is the convenience.** Every entry
 *    carries authors, title, journal/publisher, year and pages, so it stays a
 *    usable reference even after a URL rots. Links prefer PubMed and the
 *    publishing organisation's own page — the two things least likely to move.
 * 3. **Untranslated on purpose.** A citation is not prose: "Am J Clin Nutr.
 *    1990;51(2):241-247" reads the same in Serbian and English, and a
 *    translated bibliography is a bibliography with two versions to get wrong.
 *    Only the surrounding explanation lives in `messages-parts/sources.ts`.
 * 4. **Cite what the code does, not what sounds authoritative.** Where the
 *    implementation follows convention rather than a single paper — the
 *    1.2–1.9 activity multipliers — the entry says so instead of borrowing a
 *    reference that does not actually contain those numbers.
 */

export type Citation = {
  /** Stable key — referenced by the document sections. */
  id: string;
  /** Authors (or the issuing body), as they appear on the work. */
  authors: string;
  /** Title of the paper, guideline or report. */
  title: string;
  /** Journal / publisher, year, volume, pages — the part that identifies it. */
  where: string;
  /** A page a reader can actually open. */
  url: string;
};

export const CITATIONS = {
  mifflin: {
    id: "mifflin",
    authors: "Mifflin MD, St Jeor ST, Hill LA, Scott BJ, Daugherty SA, Koh YO",
    title:
      "A new predictive equation for resting energy expenditure in healthy individuals",
    where: "Am J Clin Nutr. 1990;51(2):241–247. PMID 2305711",
    url: "https://pubmed.ncbi.nlm.nih.gov/2305711/",
  },
  faoEnergy: {
    id: "faoEnergy",
    authors: "FAO / WHO / UNU Expert Consultation",
    title: "Human energy requirements (FAO Food and Nutrition Technical Report Series 1)",
    where: "Rome: FAO, 2004",
    url: "https://www.fao.org/4/y5686e/y5686e00.htm",
  },
  nhlbiObesity: {
    id: "nhlbiObesity",
    authors: "National Heart, Lung, and Blood Institute (NIH)",
    title:
      "Clinical Guidelines on the Identification, Evaluation, and Treatment of Overweight and Obesity in Adults",
    where: "NIH Publication No. 98-4083, 1998",
    url: "https://www.ncbi.nlm.nih.gov/books/NBK2003/",
  },
  issnProtein: {
    id: "issnProtein",
    authors: "Jäger R, Kerksick CM, Campbell BI, et al.",
    title:
      "International Society of Sports Nutrition Position Stand: protein and exercise",
    where: "J Int Soc Sports Nutr. 2017;14:20. PMID 28642676",
    url: "https://pubmed.ncbi.nlm.nih.gov/28642676/",
  },
  mortonProtein: {
    id: "mortonProtein",
    authors: "Morton RW, Murphy KT, McKellar SR, et al.",
    title:
      "A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults",
    where: "Br J Sports Med. 2018;52(6):376–384. PMID 28698222",
    url: "https://pubmed.ncbi.nlm.nih.gov/28698222/",
  },
  whoFats: {
    id: "whoFats",
    authors: "World Health Organization",
    title:
      "Saturated fatty acid and trans-fatty acid intake for adults and children: WHO guideline",
    where: "Geneva: WHO, 2023",
    url: "https://www.who.int/publications/i/item/9789240073630",
  },
  wishnofsky: {
    id: "wishnofsky",
    authors: "Wishnofsky M",
    title: "Caloric equivalents of gained or lost weight",
    where: "Am J Clin Nutr. 1958;6(5):542–546. PMID 13594881",
    url: "https://pubmed.ncbi.nlm.nih.gov/13594881/",
  },
  hallRule: {
    id: "hallRule",
    authors: "Hall KD, Chow CC",
    title: "Why is the 3500 kcal per pound weight loss rule wrong?",
    where: "Int J Obes (Lond). 2013;37(12):1614",
    url: "https://www.nature.com/articles/ijo2013112",
  },
  whoBmi: {
    id: "whoBmi",
    authors: "World Health Organization",
    title: "A healthy lifestyle — WHO recommendations (body mass index classification)",
    where: "WHO Regional Office for Europe, 2010",
    url: "https://www.who.int/europe/news-room/fact-sheets/item/a-healthy-lifestyle---who-recommendations",
  },
  compendium: {
    id: "compendium",
    authors: "Ainsworth BE, Haskell WL, Herrmann SD, et al.",
    title:
      "2011 Compendium of Physical Activities: a second update of codes and MET values",
    where: "Med Sci Sports Exerc. 2011;43(8):1575–1581. PMID 21681120",
    url: "https://pubmed.ncbi.nlm.nih.gov/21681120/",
  },
  dga: {
    id: "dga",
    authors: "U.S. Departments of Agriculture and Health and Human Services",
    title: "Dietary Guidelines for Americans, 2020–2025",
    where: "9th edition, December 2020",
    url: "https://www.dietaryguidelines.gov/",
  },
  whoSugars: {
    id: "whoSugars",
    authors: "World Health Organization",
    title: "Guideline: sugars intake for adults and children",
    where: "Geneva: WHO, 2015",
    url: "https://www.who.int/publications/i/item/9789241549028",
  },
  whoSodium: {
    id: "whoSodium",
    authors: "World Health Organization",
    title: "Guideline: sodium intake for adults and children",
    where: "Geneva: WHO, 2012",
    url: "https://www.who.int/publications/i/item/9789241504836",
  },
  goldberg: {
    id: "goldberg",
    authors: "Goldberg GR, Black AE, Jebb SA, et al.",
    title:
      "Critical evaluation of energy intake data using fundamental principles of energy physiology: 1. Derivation of cut-off limits to identify under-recording",
    where: "Eur J Clin Nutr. 1991;45(12):569–581. PMID 1810719",
    url: "https://pubmed.ncbi.nlm.nih.gov/1810719/",
  },
  livingstone: {
    id: "livingstone",
    authors: "Livingstone MBE, Black AE",
    title: "Markers of the validity of reported energy intake",
    where: "J Nutr. 2003;133(3):895S–920S. PMID 12612176",
    url: "https://pubmed.ncbi.nlm.nih.gov/12612176/",
  },
} as const satisfies Record<string, Citation>;

export type CitationId = keyof typeof CITATIONS;

/** Citations in the order the "Spisak izvora" section lists them. */
export const CITATION_LIST: readonly Citation[] = Object.values(CITATIONS);

/** Look up by id, for a section that cites a subset. */
export function citations(...ids: readonly CitationId[]): readonly Citation[] {
  return ids.map((id) => CITATIONS[id]);
}
