import { streamText, generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";

export const maxDuration = 60;

// ─────────────────────────────────────────────────────────────
// Setup Groq provider
// ─────────────────────────────────────────────────────────────
const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
const rewriteModel = groq("llama-3.1-8b-instant");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface SearchResult {
    title: string;
    url: string;
    favicon: string;
    snippet: string;
    engine?: string;
    category?: string;
    score?: number;
    engines?: string[];   // SearXNG returns which engines found this result
    positions?: number[]; // positions from each engine
}

interface SearXNGRawResult {
    title?: string;
    url?: string;
    content?: string;
    engine?: string;
    engines?: string[];
    positions?: number[];
    category?: string;
    score?: number;
    parsed_url?: string[];
    publishedDate?: string;
}

// ─────────────────────────────────────────────────────────────
// SearXNG Configuration
// ─────────────────────────────────────────────────────────────
const PRIVATE_INSTANCES = (process.env.SEARXNG_INSTANCES || "").split(",").filter(Boolean);
const PUBLIC_FALLBACK_INSTANCES = [
    "https://search.sapti.me",
    "https://priv.au",
    "https://searxng.au",
    "https://search.ononoki.org",
    "https://search.bus-hit.me",
    "https://searx.be",
];

// ─────────────────────────────────────────────────────────────
// CORE: SearXNG Instance Query — Optimized
// ─────────────────────────────────────────────────────────────

async function querySearXNGInstance(
    instance: string,
    query: string,
    options: {
        categories?: string;
        engines?: string;
        language?: string;
        timeRange?: string;
        pageno?: number;
    } = {}
): Promise<SearchResult[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const params = new URLSearchParams({
            q: query,
            format: "json",
            language: options.language || "en",
        });

        if (options.categories) params.set("categories", options.categories);
        if (options.engines) params.set("engines", options.engines);
        if (options.timeRange) params.set("time_range", options.timeRange);
        if (options.pageno) params.set("pageno", options.pageno.toString());

        const url = `${instance.trim()}/search?${params.toString()}`;
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                "Accept": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            },
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        if (!data.results || data.results.length === 0) return [];

        return data.results.map((r: SearXNGRawResult) => ({
            title: r.title || "Untitled",
            url: r.url || "",
            favicon: "",
            snippet: r.content || "",
            engine: r.engine || "",
            engines: r.engines || [],
            positions: r.positions || [],
            category: r.category || "",
            score: r.score || 0,
        }));
    } catch {
        clearTimeout(timeout);
        throw new Error("Instance failed");
    }
}

// ─────────────────────────────────────────────────────────────
// Smart Instance Selection — Private First, Public Fallback
// ─────────────────────────────────────────────────────────────

async function querySearXNG(
    query: string,
    options: {
        categories?: string;
        engines?: string;
        timeRange?: string;
        pageno?: number;
    } = {}
): Promise<SearchResult[]> {
    // 1. Try private instances first (your AWS instance)
    for (const instance of PRIVATE_INSTANCES) {
        try {
            const results = await querySearXNGInstance(instance, query, options);
            if (results.length > 0) return results;
        } catch {
            console.warn(`[SearXNG] Private instance failed: ${instance}`);
        }
    }

    // 2. Fallback: Race public instances
    if (PUBLIC_FALLBACK_INSTANCES.length > 0) {
        const racePromises = PUBLIC_FALLBACK_INSTANCES.map(async (instance) => {
            const results = await querySearXNGInstance(instance, query, options);
            if (results.length > 0) return results;
            throw new Error("Empty results");
        });

        try {
            return await Promise.any(racePromises);
        } catch {
            return [];
        }
    }

    return [];
}

// ─────────────────────────────────────────────────────────────
// Multi-Strategy Search — The Core Engine
// ─────────────────────────────────────────────────────────────

async function searchSearXNG(query: string, queryInfo: QueryClassification): Promise<SearchResult[]> {
    const searchPromises: Promise<SearchResult[]>[] = [];

    // Strategy 1: General web search (uses all enabled engines in SearXNG)
    searchPromises.push(
        querySearXNG(query, { categories: "general" })
    );

    // Strategy 2: Specific high-quality engines
    // DuckDuckGo + Wikipedia are always reliable
    searchPromises.push(
        querySearXNG(query, {
            engines: "duckduckgo,wikipedia",
        })
    );

    // Strategy 3: For person queries, target social/professional platforms
    if (queryInfo.isPerson) {
        searchPromises.push(
            querySearXNG(
                `${query} linkedin OR github OR twitter`,
                { categories: "general" }
            )
        );
    }

    // Strategy 4: For current events, search news category
    if (queryInfo.isCurrentEvents) {
        searchPromises.push(
            querySearXNG(query, { categories: "news", timeRange: "week" })
        );
    }

    // Strategy 5: For technical queries, search IT category
    if (queryInfo.isTechnical) {
        searchPromises.push(
            querySearXNG(query, {
                engines: "duckduckgo,wikipedia",
            })
        );
        searchPromises.push(
            querySearXNG(`${query} site:stackoverflow.com OR site:github.com OR site:dev.to`, {
                categories: "general",
            })
        );
    }

    // Strategy 6: For comparison queries, add broader search
    if (queryInfo.isComparison) {
        searchPromises.push(
            querySearXNG(`${query} comparison review`, { categories: "general" })
        );
    }

    const allResults = await Promise.all(
        searchPromises.map((p) => p.catch(() => [] as SearchResult[]))
    );

    // Merge all results — use Map for dedup, but BOOST score for cross-query hits
    const urlMap = new Map<string, SearchResult & { crossQueryHits: number }>();

    for (const results of allResults) {
        for (const r of results) {
            if (!r.url) continue;

            const existing = urlMap.get(r.url);
            if (existing) {
                // Cross-query hit = strong relevance signal
                existing.crossQueryHits += 1;
                existing.score = (existing.score || 0) + 3;
                // Keep the richer snippet
                if (r.snippet && r.snippet.length > (existing.snippet?.length || 0)) {
                    existing.snippet = r.snippet;
                }
                // Merge engines list
                if (r.engines) {
                    const existingEngines = new Set(existing.engines || []);
                    for (const e of r.engines) existingEngines.add(e);
                    existing.engines = Array.from(existingEngines);
                }
            } else {
                urlMap.set(r.url, { ...r, crossQueryHits: 1 });
            }
        }
    }

    return Array.from(urlMap.values());
}

// ─────────────────────────────────────────────────────────────
// BM25-Lite Relevance Scoring — The Key Differentiator
// ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
    "the", "and", "for", "are", "but", "not", "you", "all", "can",
    "had", "her", "was", "one", "our", "out", "has", "have", "from",
    "been", "some", "what", "when", "who", "how", "why", "which",
    "their", "them", "then", "than", "this", "that", "with", "will",
    "about", "does", "into", "more", "also", "just", "only", "very",
    "even", "most", "much", "such", "each", "both", "like", "being",
    "where", "after", "back", "could", "would", "should", "there",
    "these", "other", "your", "tell", "find", "make", "know", "take",
]);

function extractKeywords(text: string): string[] {
    return text.toLowerCase()
        .split(/[\s\-_.,;:!?'"()\[\]{}|/\\@#$%^&*+=<>~`]+/)
        .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

/**
 * BM25-lite scoring for search result relevance.
 * This is a simplified version of Okapi BM25, the algorithm
 * used by real search engines (including Google).
 */
function bm25Score(
    result: SearchResult,
    queryKeywords: string[],
    allResults: SearchResult[]
): number {
    const k1 = 1.5;
    const b = 0.75;

    const titleText = (result.title || "").toLowerCase();
    const snippetText = (result.snippet || "").toLowerCase();
    const docText = titleText + " " + snippetText;
    const docLength = docText.split(/\s+/).length;

    // Average doc length across all results
    const avgDocLen = allResults.reduce((sum, r) => {
        const t = ((r.title || "") + " " + (r.snippet || "")).split(/\s+/).length;
        return sum + t;
    }, 0) / Math.max(allResults.length, 1);

    let score = 0;
    const N = allResults.length;

    for (const term of queryKeywords) {
        // Term frequency in this document
        const termRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const tf = (docText.match(termRegex) || []).length;

        if (tf === 0) continue;

        // Document frequency (how many results have this term)
        const df = allResults.filter((r) => {
            const t = ((r.title || "") + " " + (r.snippet || "")).toLowerCase();
            return t.includes(term);
        }).length;

        // IDF (rare terms are more valuable)
        const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

        // BM25 formula
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLength / avgDocLen)));
        score += idf * tfNorm;

        // Title match bonus (appearing in title is MUCH more relevant)
        if (titleText.includes(term)) {
            score += idf * 2.0; // Double boost for title matches
        }
    }

    return score;
}

// ─────────────────────────────────────────────────────────────
// Domain Quality & Authority Scoring
// ─────────────────────────────────────────────────────────────

const DOMAIN_AUTHORITY: Record<string, number> = {
    // Tier 1: Highest authority
    "wikipedia.org": 10,
    "linkedin.com": 9,
    "github.com": 9,
    "stackoverflow.com": 9,
    "developer.mozilla.org": 8,
    "docs.python.org": 8,
    "learn.microsoft.com": 8,

    // Tier 2: High authority
    "medium.com": 6,
    "dev.to": 6,
    "reddit.com": 6,
    "twitter.com": 5,
    "x.com": 5,
    "youtube.com": 5,
    "arxiv.org": 7,
    "nature.com": 7,
    "bbc.com": 6,
    "reuters.com": 6,
    "nytimes.com": 6,
    "washingtonpost.com": 6,
    "theguardian.com": 6,
    "techcrunch.com": 6,
    "arstechnica.com": 6,
    "wired.com": 6,

    // Tier 3: Good sources
    "vercel.com": 5,
    "nextjs.org": 5,
    "react.dev": 5,
    "hashnode.com": 4,
    "aws.amazon.com": 5,
    "cloud.google.com": 5,
    "docs.oracle.com": 5,
    "freecodecamp.org": 4,
    "w3schools.com": 3,
    "geeksforgeeks.org": 3,
    "instagram.com": 3,
    "facebook.com": 3,

    // Negative: Low quality / SEO spam
    "pinterest.com": -2,
    "quora.com": 1,
};

function getDomainAuthority(url: string): number {
    const hostname = getHostname(url);
    for (const [domain, authority] of Object.entries(DOMAIN_AUTHORITY)) {
        if (hostname.includes(domain)) return authority;
    }
    // Default: neutral for unknown domains
    return 2;
}

// ─────────────────────────────────────────────────────────────
// Smart Query Classification — Enhanced
// ─────────────────────────────────────────────────────────────

interface QueryClassification {
    isCurrentEvents: boolean;
    isSimple: boolean;
    isTechnical: boolean;
    isPerson: boolean;
    isComparison: boolean;
    isDefinition: boolean;
    isHowTo: boolean;
    queryType: "factual" | "exploratory" | "navigational" | "transactional";
}

function classifyQuery(query: string): QueryClassification {
    const lower = query.toLowerCase();

    const currentEventSignals = [
        "latest", "recent", "today", "news", "2025", "2026", "now",
        "current", "update", "new", "just", "breaking", "announced",
        "released", "launched", "happened", "trending", "this week",
        "this month", "this year",
    ];

    const technicalSignals = [
        "code", "programming", "api", "sdk", "function", "error",
        "debug", "algorithm", "data structure", "implementation",
        "framework", "library", "syntax", "compile", "runtime",
        "docker", "kubernetes", "deploy", "server", "database",
        "react", "nextjs", "python", "javascript", "typescript",
        "rust", "golang", "java", "c++", "css", "html",
        "npm", "pip", "cargo", "yarn", "git",
    ];

    const personSignals = [
        "who is", "who are", "who was", "about him", "about her",
        "about them", "biography", "profile", "founder of",
        "ceo of", "created by", "invented by",
    ];

    const comparisonSignals = [
        "vs", "versus", "compared to", "difference between",
        "better than", "comparison", "alternative to",
        "pros and cons",
    ];

    const definitionSignals = [
        "what is", "what are", "define", "definition",
        "meaning of", "explain", "what does",
    ];

    const howToSignals = [
        "how to", "how do", "how can", "tutorial",
        "guide", "step by step", "instructions",
    ];

    const isCurrentEvents = currentEventSignals.some((s) => lower.includes(s));
    const isTechnical = technicalSignals.some((s) => lower.includes(s));
    const isPerson = personSignals.some((s) => lower.includes(s));
    const isComparison = comparisonSignals.some((s) => lower.includes(s));
    const isDefinition = definitionSignals.some((s) => lower.includes(s));
    const isHowTo = howToSignals.some((s) => lower.includes(s));
    const isSimple = lower.split(/\s+/).length <= 4 && !lower.includes("?") && !isTechnical;

    // Determine query type for better search strategy
    let queryType: "factual" | "exploratory" | "navigational" | "transactional" = "exploratory";
    if (isDefinition || isSimple) queryType = "factual";
    if (isPerson || lower.includes("site:")) queryType = "navigational";
    if (isComparison || isHowTo) queryType = "exploratory";

    return { isCurrentEvents, isSimple, isTechnical, isPerson, isComparison, isDefinition, isHowTo, queryType };
}

// ─────────────────────────────────────────────────────────────
// Domain Diversity Filter
// ─────────────────────────────────────────────────────────────

function enforceDomainDiversity(results: SearchResult[], maxPerDomain: number = 2): SearchResult[] {
    const domainCount = new Map<string, number>();
    const diverse: SearchResult[] = [];

    for (const r of results) {
        const domain = getHostname(r.url);
        const count = domainCount.get(domain) || 0;

        if (count < maxPerDomain) {
            diverse.push(r);
            domainCount.set(domain, count + 1);
        }
    }

    return diverse;
}

// ─────────────────────────────────────────────────────────────
// Relevance Filter — Remove Junk Results
// ─────────────────────────────────────────────────────────────

function isResultRelevant(result: SearchResult, query: string, queryInfo: QueryClassification): boolean {
    const titleLower = (result.title || "").toLowerCase();
    const snippetLower = (result.snippet || "").toLowerCase();
    const urlLower = (result.url || "").toLowerCase();
    const queryLower = query.toLowerCase();

    const queryWords = queryLower.split(/\s+/).filter((w: string) => w.length > 1 && !STOP_WORDS.has(w));
    if (queryWords.length === 0) return true;

    const combinedText = titleLower + " " + snippetLower + " " + urlLower;
    const matchingWords = queryWords.filter((w: string) => combinedText.includes(w));
    const matchRatio = matchingWords.length / queryWords.length;

    // Require at least 25% keyword match
    if (matchRatio < 0.25) return false;

    // Filter out irrelevant domains for person queries
    if (queryInfo.isPerson) {
        const irrelevantForPeople = [
            "biblegateway.com", "biblehub.com", "bible.com",
            "openbible.info", "gotquestions.org", "christianity.com",
            "behindthename.com", "nameberry.com", "babycenter.com",
        ];
        const hostname = getHostname(result.url);
        if (irrelevantForPeople.some((d) => hostname.includes(d))) {
            if (!queryLower.includes("bible") && !queryLower.includes("gospel")) {
                return false;
            }
        }
    }

    // Filter out low-quality SEO spam
    const spamSignals = [
        "buy now", "free download", "click here", "subscribe now",
        "limited offer", "act now", "don't miss",
    ];
    if (spamSignals.some((s) => snippetLower.includes(s) || titleLower.includes(s))) {
        return false;
    }

    return true;
}

// ─────────────────────────────────────────────────────────────
// Content Extraction — Optimized Multi-Strategy
// ─────────────────────────────────────────────────────────────

// Domains that are known to be slow or block scrapers
const SLOW_DOMAINS = new Set([
    "linkedin.com", "facebook.com", "instagram.com",
    "twitter.com", "x.com", "tiktok.com",
]);

async function extractPageContent(
    url: string,
    fallbackSnippet: string,
    timeoutMs: number = 6000
): Promise<{ url: string; text: string; method: string }> {
    const hostname = getHostname(url);

    // Skip known slow/blocked domains — use snippet directly
    if (SLOW_DOMAINS.has(hostname)) {
        return { url, text: fallbackSnippet, method: "snippet" };
    }

    const jinaPromise = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(`https://r.jina.ai/${url}`, {
                headers: {
                    Accept: "text/plain",
                    "X-Retain-Images": "none",
                    "X-Return-Format": "text",
                },
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const text = await res.text();
            if (text.trim().length < 80) throw new Error("Content too short");
            return { url, text, method: "jina" };
        } catch (e) {
            clearTimeout(timeout);
            throw e;
        }
    })();

    const directPromise = (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs - 2000);
        try {
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; AetheronBot/1.0)",
                    "Accept": "text/html",
                },
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            const text = extractTextFromHtml(html);
            if (text.length < 100) throw new Error("Content too short");
            return { url, text: text.substring(0, 15000), method: "direct" };
        } catch (e) {
            clearTimeout(timeout);
            throw e;
        }
    })();

    try {
        return await Promise.any([jinaPromise, directPromise]);
    } catch {
        return { url, text: fallbackSnippet, method: "snippet" };
    }
}

function extractTextFromHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[\s\S]*?<\/header>/gi, "")
        .replace(/<aside[\s\S]*?<\/aside>/gi, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

// ─────────────────────────────────────────────────────────────
// Smart Chunking with Overlap
// ─────────────────────────────────────────────────────────────

function smartChunk(text: string, maxChunkSize: number = 2000): string[] {
    const chunks: string[] = [];
    const paragraphs = text.split(/\n\n+/);
    let current = "";

    for (const para of paragraphs) {
        const trimmedPara = para.trim();
        if (!trimmedPara) continue;

        // Skip boilerplate content
        if (isBoilerplate(trimmedPara)) continue;

        if (current.length + trimmedPara.length > maxChunkSize) {
            if (current.trim().length > 80) {
                chunks.push(current.trim());
            }
            // Sentence overlap for context continuity
            const lastSentences = current.split(/[.!?]+/).filter((s) => s.trim());
            const overlap = lastSentences.length > 0 ? lastSentences[lastSentences.length - 1].trim() : "";
            current = overlap ? overlap + ".\n\n" + trimmedPara : trimmedPara;
        } else {
            current += (current ? "\n\n" : "") + trimmedPara;
        }
    }

    if (current.trim().length > 80) {
        chunks.push(current.trim());
    }

    return chunks;
}

function isBoilerplate(text: string): boolean {
    const lower = text.toLowerCase();
    const boilerplateSignals = [
        "cookie", "privacy policy", "terms of service",
        "subscribe to newsletter", "accept all cookies",
        "we use cookies", "copyright ©", "all rights reserved",
        "sign up for free", "create an account",
        "advertisement", "sponsored content",
        "share this article", "follow us on",
    ];
    return boilerplateSignals.some((s) => lower.includes(s)) && text.length < 200;
}

// ─────────────────────────────────────────────────────────────
// Chunk Relevance Scoring — BM25 for Chunks
// ─────────────────────────────────────────────────────────────

function scoreChunk(chunk: string, queryKeywords: string[]): number {
    const lower = chunk.toLowerCase();
    const k1 = 1.5;
    const b = 0.75;
    const docLen = lower.split(/\s+/).length;
    const avgDocLen = 200; // Average chunk size estimate

    let score = 0;

    for (const term of queryKeywords) {
        const termRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
        const tf = (lower.match(termRegex) || []).length;
        if (tf === 0) continue;

        // Simplified IDF (treat each chunk as document)
        const idf = Math.log(2.0); // Simplified since we don't have corpus stats
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)));
        score += idf * tfNorm;
    }

    // Bonus for structured content (sentences, paragraphs)
    const sentences = chunk.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    if (sentences.length >= 3) score += 1;
    if (chunk.length > 500) score += 0.5;
    if (chunk.length > 1500) score += 0.5;

    // Penalty for link-heavy content (usually navigation/footer)
    const linkDensity = (chunk.match(/https?:\/\//g) || []).length / Math.max(chunk.length / 100, 1);
    if (linkDensity > 0.3) score -= 3;

    return score;
}

// ─────────────────────────────────────────────────────────────
// Web Search Orchestrator — The Main Search Pipeline
// ─────────────────────────────────────────────────────────────

async function webSearch(query: string, queryInfo: QueryClassification): Promise<SearchResult[]> {
    // Get results from SearXNG (which internally queries multiple engines)
    const results = await searchSearXNG(query, queryInfo).catch(() => [] as SearchResult[]);

    // Filter irrelevant results
    const filtered = results.filter((r) => isResultRelevant(r, query, queryInfo));

    return filtered;
}

// ─────────────────────────────────────────────────────────────
// Advanced Result Ranking — Combines Multiple Signals
// ─────────────────────────────────────────────────────────────

function rankResults(
    results: SearchResult[],
    query: string,
    queryInfo: QueryClassification
): SearchResult[] {
    const queryKeywords = extractKeywords(query);

    const scored = results.map((result) => {
        let totalScore = 0;

        // 1. BM25 text relevance (0-20 range)
        totalScore += bm25Score(result, queryKeywords, results) * 3;

        // 2. Domain authority (0-10 range)
        totalScore += getDomainAuthority(result.url);

        // 3. SearXNG score (multi-engine agreement)
        totalScore += (result.score || 0) * 2;

        // 4. Cross-query frequency bonus
        const crossHits = (result as SearchResult & { crossQueryHits?: number }).crossQueryHits || 1;
        totalScore += (crossHits - 1) * 5;

        // 5. Number of SearXNG engines that found this result
        const engineCount = (result.engines || []).length;
        totalScore += engineCount * 2;

        // 6. Context-specific boosts
        if (queryInfo.isPerson) {
            const hostname = getHostname(result.url);
            const personDomains = ["linkedin.com", "github.com", "twitter.com", "x.com"];
            if (personDomains.some((d) => hostname.includes(d))) {
                totalScore += 8;
            }
        }

        if (queryInfo.isTechnical) {
            const hostname = getHostname(result.url);
            const techDomains = ["stackoverflow.com", "github.com", "developer.mozilla.org", "docs.python.org"];
            if (techDomains.some((d) => hostname.includes(d))) {
                totalScore += 6;
            }
        }

        // 7. Snippet quality bonus
        if (result.snippet && result.snippet.length > 100) {
            totalScore += 2;
        }

        return { ...result, _totalScore: totalScore };
    });

    // Sort by total score
    scored.sort((a, b) => b._totalScore - a._totalScore);

    // Return without internal score field
    return scored.map(({ _totalScore, ...rest }) => rest);
}

// ─────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────

function getHostname(url: string): string {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return url;
    }
}

// ─────────────────────────────────────────────────────────────
// API Route Handler
// ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
    try {
        const { messages, model: requestedModel, mode: searchMode } = await req.json();
        const selectedAnswerModel = groq(
            requestedModel || process.env.ANSWER_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"
        );
        const latestMessage = messages[messages.length - 1];
        const query = latestMessage.content;

        const modeMap = {
            search: { maxQueries: 5, maxSources: 10, maxUrlsToRead: 6, maxChunks: 15, maxContext: 14000, label: "Search" },
            research: { maxQueries: 7, maxSources: 15, maxUrlsToRead: 8, maxChunks: 20, maxContext: 20000, label: "Research" },
            deep_research: { maxQueries: 10, maxSources: 20, maxUrlsToRead: 10, maxChunks: 30, maxContext: 28000, label: "Deep Research" },
        };
        const safeMode: keyof typeof modeMap = Object.keys(modeMap).includes(searchMode) ? searchMode : "search";
        const modeConfig = modeMap[safeMode];

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (type: string, data: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
                };

                try {
                    sendEvent("step", { message: `${modeConfig.label}: Understanding your question...` });

                    // ── Step 1: Classify Query ────────────────────────
                    const queryInfo = classifyQuery(query);

                    // ── Step 2: Smart Query Rewriting ──────────────────
                    let rewrittenQueries: string[] = [];
                    let coreQuery = query;

                    try {
                        const historyContext = messages.slice(-5, -1).map((m: { role: string; content: string }) =>
                            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 300)}`
                        ).join('\n');

                        let rewriteSystemPrompt = `You are an expert search query optimizer. You understand how search engines work and generate queries that maximize result quality. Output ONLY valid JSON. Never output markdown, explanation, or conversational text.

RULES:
- Generate DIVERSE queries targeting different angles/sources
- Use natural language, avoid excessive quoting
- Include relevant context terms (profession, location, technology, etc.)
- Each query should find DIFFERENT types of results
- For ambiguous queries, include disambiguation terms`;

                        if (queryInfo.isPerson) {
                            rewriteSystemPrompt += `\n\nPERSON SEARCH RULES:
- Query 1: Full professional profile (LinkedIn-style)
- Query 2: Technical/work contributions
- Query 3: Social media presence
- Query 4: News mentions or interviews
- Query 5: Personal website or blog
- Add profession terms like "developer", "engineer", "designer", "founder"
- Do NOT wrap names in quotes`;
                        }

                        if (queryInfo.isTechnical) {
                            rewriteSystemPrompt += `\n\nTECH SEARCH RULES:
- Query 1: Official documentation
- Query 2: Tutorial/how-to guide
- Query 3: Stack Overflow / community answers
- Query 4: GitHub repos or examples
- Query 5: Comparison or best practices`;
                        }

                        let rewritePrompt = "";

                        if (historyContext.length > 0) {
                            rewritePrompt = `Conversation History:\n${historyContext}\n\nLatest User Query: "${query}"\n\nBased on the conversation history, determine what the user is ACTUALLY asking about. Resolve ALL pronouns with their specific referents.\n\nGenerate 5 diverse, highly specific search queries. Each query MUST target a completely different source or angle.\n\nRespond with ONLY: {"core_query": "The fully resolved question", "search_queries": ["q1", "q2", "q3", "q4", "q5"]}`;
                        } else {
                            rewritePrompt = `User Query: "${query}"\n\nGenerate 5 diverse search queries that together will comprehensively answer this query from multiple angles and sources.\n\nRespond with ONLY: {"core_query": "${query}", "search_queries": ["q1", "q2", "q3", "q4", "q5"]}`;
                        }

                        const { text: rewriteResult } = await generateText({
                            model: rewriteModel,
                            system: rewriteSystemPrompt,
                            prompt: rewritePrompt,
                        });

                        const jsonMatch = rewriteResult.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.core_query) coreQuery = parsed.core_query;
                            if (Array.isArray(parsed.search_queries)) {
                                rewrittenQueries = parsed.search_queries.slice(0, modeConfig.maxQueries);
                            } else if (Array.isArray(parsed.queries)) {
                                rewrittenQueries = parsed.queries.slice(0, modeConfig.maxQueries);
                            }
                        }
                    } catch (e) {
                        console.warn("Query rewriting failed, using original query:", e);
                    }

                    // ── Step 3: Multi-Query Parallel Search ───────────
                    const queriesToSearch = Array.from(new Set([coreQuery, ...rewrittenQueries])).slice(0, modeConfig.maxQueries + 1);
                    console.log(`[Aetheron ${modeConfig.label}] Queries:`, queriesToSearch);

                    sendEvent("step", { message: `Searching across multiple sources...` });

                    // Search all queries in parallel
                    const searchPromises = queriesToSearch.map((q: string) =>
                        webSearch(q, queryInfo)
                    );
                    const searchResultsArrays = await Promise.all(searchPromises);

                    // ── Step 4: Merge, Score & Rank All Results ────────
                    // Merge with cross-query hit tracking
                    const urlScoreMap = new Map<string, SearchResult & { crossQueryHits: number }>();

                    for (const results of searchResultsArrays) {
                        for (const r of results) {
                            if (!r.url) continue;
                            const existing = urlScoreMap.get(r.url);
                            if (existing) {
                                existing.crossQueryHits += 1;
                                existing.score = (existing.score || 0) + (r.score || 0);
                                if (r.snippet && r.snippet.length > (existing.snippet?.length || 0)) {
                                    existing.snippet = r.snippet;
                                }
                                // Merge engine lists
                                if (r.engines) {
                                    const existingEngines = new Set(existing.engines || []);
                                    for (const e of r.engines) existingEngines.add(e);
                                    existing.engines = Array.from(existingEngines);
                                }
                            } else {
                                urlScoreMap.set(r.url, { ...r, crossQueryHits: 1 });
                            }
                        }
                    }

                    const mergedResults = Array.from(urlScoreMap.values());

                    // Apply BM25 + authority ranking
                    const rankedResults = rankResults(mergedResults, query, queryInfo);

                    // Enforce domain diversity and take top results
                    const topSources = enforceDomainDiversity(rankedResults, 2).slice(0, modeConfig.maxSources);
                    const topUrls = topSources.map((s) => s.url);

                    console.log("[Aetheron Sources]", topSources.map((s) => `${getHostname(s.url)}: ${s.title} (engines: ${s.engines?.join(",") || "?"})`));

                    // Send sources early for fast UI
                    sendEvent("sources", { sources: topSources });

                    if (topUrls.length > 0) {
                        sendEvent("step", { message: `Found ${topUrls.length} sources. Reading content...` });
                    }

                    // ── Step 5: Content Extraction ────────────────────
                    const urlsToRead = topUrls.slice(0, modeConfig.maxUrlsToRead);
                    const extractionPromises = urlsToRead.map(async (url: string) => {
                        const hostname = getHostname(url);
                        const fallbackSnippet = topSources.find((s) => s.url === url)?.snippet || "";
                        sendEvent("reading_url", { url, hostname });

                        try {
                            const result = await extractPageContent(url, fallbackSnippet, 6000);
                            sendEvent("read_complete", { url, hostname, success: true });
                            return result;
                        } catch {
                            sendEvent("read_complete", { url, hostname, success: true });
                            return { url, text: fallbackSnippet, method: "snippet" };
                        }
                    });

                    const pagesContent = await Promise.all(extractionPromises);

                    // ── Step 6: Smart Chunking & BM25 Scoring ─────────
                    const queryKeywords = extractKeywords(query + " " + coreQuery);
                    const allChunks: { url: string; text: string; score: number; method: string }[] = [];

                    for (const { url, text, method } of pagesContent) {
                        if (!text || text.length < 50) continue;
                        const chunks = smartChunk(text, 2000);
                        for (const chunk of chunks) {
                            const relevance = scoreChunk(chunk, queryKeywords);
                            // Boost chunks from full content extraction
                            const methodBoost = method === "jina" ? 2 : method === "direct" ? 1 : 0;
                            allChunks.push({
                                url,
                                text: chunk,
                                score: relevance + methodBoost,
                                method,
                            });
                        }
                    }

                    // Add snippets from sources we didn't fully read
                    for (const source of topSources) {
                        if (source.snippet && source.snippet.length > 30 && !urlsToRead.includes(source.url)) {
                            allChunks.push({
                                url: source.url,
                                text: source.snippet,
                                score: scoreChunk(source.snippet, queryKeywords) - 1,
                                method: "snippet",
                            });
                        }
                    }

                    // Take top chunks, ensuring source diversity
                    const chunksByUrl = new Map<string, number>();
                    const topChunks: typeof allChunks = [];
                    const sortedChunks = allChunks.sort((a, b) => b.score - a.score);

                    for (const chunk of sortedChunks) {
                        if (topChunks.length >= modeConfig.maxChunks) break;
                        const urlCount = chunksByUrl.get(chunk.url) || 0;
                        if (urlCount >= 3) continue; // Max 3 chunks per URL
                        topChunks.push(chunk);
                        chunksByUrl.set(chunk.url, urlCount + 1);
                    }

                    // ── Step 7: Build RAG Context ──────────────────────
                    let contextText = "";
                    let totalContextLength = 0;
                    const maxContextLength = modeConfig.maxContext;

                    for (const chunk of topChunks) {
                        if (totalContextLength > maxContextLength) break;
                        const sourceIndex = topSources.findIndex((s) => s.url === chunk.url);
                        if (sourceIndex === -1) continue;
                        const chunkText = `[Source ${sourceIndex + 1}: ${topSources[sourceIndex].title} - ${getHostname(chunk.url)}]\n${chunk.text}\n\n`;
                        contextText += chunkText;
                        totalContextLength += chunkText.length;
                    }

                    // Fallback: use snippets if no chunks available
                    if (topChunks.length === 0 && topSources.length > 0) {
                        topSources.forEach((s, idx) => {
                            if (s.snippet) {
                                contextText += `[Source ${idx + 1}: ${s.title} - ${getHostname(s.url)}]\n${s.snippet}\n\n`;
                            }
                        });
                    }

                    let sourceListText = "## Available sources & metadata:\n";
                    topSources.forEach((s, idx) => {
                        sourceListText += `[${idx + 1}] Title: ${s.title}\n    URL: ${s.url}\n    Summary/Snippet: ${s.snippet || "No snippet available"}\n\n`;
                    });

                    // ── Step 8: Generate Answer ───────────────────────
                    const ragSystemPrompt = `You are Aetheron, an advanced AI research assistant playing the role of a world-class search engine. You provide thorough, well-organized, and authoritative answers based on your provided sources.

## Core Principles:
1. **Be Confident & Definitive**: Use the provided source content to build the best possible answer. Never say "I don't have enough information" — synthesize from titles, URLs, snippets, and extracted content.
2. **Synthesize Across Sources**: Combine information from multiple sources into a coherent, comprehensive analysis. Don't just list what each source says.
3. **Citation**: Cite inline using [1], [2], etc., matching source numbers. Every major claim should have a citation.
4. **Depth**: For complex topics, provide detailed explanations with examples. For simple questions, be concise but thorough.

## Formatting Rules:
- Use **bold** for key names, concepts, technologies, and roles
- Use bullet points for lists of features, attributes, or steps
- Use headers (##) to organize longer answers into sections
- For people, synthesize their professional background from available profiles
- For technical topics, include code examples when relevant
- For comparisons, use tables when appropriate

## Answer Quality Standards:
- Minimum 3 sentences for simple factual answers
- Minimum 2 paragraphs for exploratory/comparison questions
- Every answer must cite at least 2 sources
- Prioritize accuracy over length — wrong information is worse than brief correct information

${sourceListText}

## Deep Extracted Content (if available):
${contextText.length > 5 ? contextText : "No deep extraction available. Rely ENTIRELY on the Available sources & metadata above to answer the query. Be creative in synthesizing the available snippets and metadata into a rich, informative answer."}`;

                    sendEvent("step", { message: "Generating comprehensive answer..." });

                    const result = await streamText({
                        model: selectedAnswerModel,
                        system: ragSystemPrompt,
                        messages: messages,
                    });

                    for await (const chunk of result.textStream) {
                        sendEvent("text-delta", { delta: chunk });
                    }

                    sendEvent("done", {});
                    controller.close();
                } catch (error: unknown) {
                    console.error("Stream execution error:", error);
                    sendEvent("error", { message: (error instanceof Error ? error.message : "An error occurred") });
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });
    } catch (error) {
        console.error("Search API Error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to search. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
