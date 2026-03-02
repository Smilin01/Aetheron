import { streamText, generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";

export const maxDuration = 60;

// Setup native Groq provider
const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
});

// Fast model for query rewriting
const rewriteModel = groq("llama-3.1-8b-instant");

interface SearchResult {
    title: string;
    url: string;
    favicon: string;
    snippet: string;
}

// ─── SearXNG-powered search (uses public instances with fallback) ───
const SEARXNG_INSTANCES = (process.env.SEARXNG_INSTANCES || "").split(",").filter(Boolean);

async function searchSearXNG(query: string): Promise<SearchResult[]> {
    const instances = SEARXNG_INSTANCES.length > 0
        ? SEARXNG_INSTANCES
        : [
            "https://search.sapti.me",
            "https://searx.be",
            "https://priv.au",
            "https://search.bus-hit.me",
        ];

    for (const instance of instances) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            const url = `${instance.trim()}/search?q=${encodeURIComponent(query)}&format=json&language=en`;
            const res = await fetch(url, {
                signal: controller.signal,
                headers: {
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                },
            });
            clearTimeout(timeout);

            if (!res.ok) continue;

            const data = await res.json();
            if (!data.results || data.results.length === 0) continue;

            return data.results.slice(0, 10).map((r: any) => ({
                title: r.title || "Untitled",
                url: r.url || "",
                favicon: "",
                snippet: r.content || "",
            }));
        } catch {
            continue;
        }
    }

    return [];
}

// ─── DuckDuckGo Lite HTML search (reliable fallback) ───
async function searchDuckDuckGoLite(query: string): Promise<SearchResult[]> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch("https://lite.duckduckgo.com/lite/", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            body: `q=${encodeURIComponent(query)}`,
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) return [];

        const html = await res.text();
        const results: SearchResult[] = [];

        const linkRegex = /href="([^"]+)"\s+class='result-link'>([^<]*(?:<b>[^<]*<\/b>[^<]*)*)<\/a>/g;
        const snippetRegex = /<td class='result-snippet'>\s*([\s\S]*?)\s*<\/td>/g;

        const links: { url: string; title: string }[] = [];
        const snippets: string[] = [];

        let match;
        while ((match = linkRegex.exec(html)) !== null) {
            links.push({
                url: match[1],
                title: match[2].replace(/<[^>]*>/g, "").trim(),
            });
        }
        while ((match = snippetRegex.exec(html)) !== null) {
            snippets.push(match[1].replace(/<[^>]*>/g, "").replace(/&\w+;/g, " ").trim());
        }

        for (let i = 0; i < links.length && results.length < 10; i++) {
            if (links[i].url) {
                results.push({
                    title: links[i].title || "Untitled",
                    url: links[i].url,
                    favicon: "",
                    snippet: snippets[i] || "",
                });
            }
        }

        return results;
    } catch {
        return [];
    }
}

// ─── Combined search: try SearXNG first, fall back to DDG Lite ───
async function webSearch(query: string): Promise<SearchResult[]> {
    let results = await searchSearXNG(query);
    if (results.length > 0) return results;

    results = await searchDuckDuckGoLite(query);
    return results;
}

function getHostname(url: string): string {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return url;
    }
}

export async function POST(req: Request) {
    try {
        const { messages, model: requestedModel } = await req.json();
        const selectedAnswerModel = groq(
            requestedModel || process.env.ANSWER_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct"
        );
        const latestMessage = messages[messages.length - 1];
        const query = latestMessage.content;

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const sendEvent = (type: string, data: any) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type, ...data })}\n\n`));
                };

                try {
                    sendEvent("step", { message: "Understanding your question..." });

                    // 1. Rewrite query based on conversation history
                    let rewrittenQueries: string[] = [];
                    let coreQuery = query; // The contextualized main query

                    try {
                        // Format history for context (last 4 messages to save tokens)
                        const historyContext = messages.slice(-5, -1).map((m: any) =>
                            `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 300)}`
                        ).join('\n');

                        const rewritePrompt = historyContext.length > 0
                            ? `Conversation History:\n${historyContext}\n\nLatest User Query: "${query}"\n\nBased on the history, what is the user ACTUALLY asking about in the latest query? Resolve pronouns like "this", "it", or "he".\nRespond with ONLY a JSON object in this exact format: {"core_query": "The fully resolved question standalone", "search_queries": ["optimized search 1", "optimized search 2"]}. No other text.`
                            : `User Query: "${query}"\n\nRewrite the user's query into 2 distinct, highly optimized web search queries. Respond with ONLY a JSON object in this exact format: {"core_query": "${query}", "search_queries": ["optimized search 1", "optimized search 2"]}. No other text.`;

                        const { text: rewriteResult } = await generateText({
                            model: rewriteModel,
                            system: "You are an expert search query generator. You output ONLY valid JSON. Never output markdown formatting or conversational text.",
                            prompt: rewritePrompt,
                        });

                        const jsonMatch = rewriteResult.match(/\{[\s\S]*\}/);
                        if (jsonMatch) {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.core_query) {
                                coreQuery = parsed.core_query;
                            }
                            if (Array.isArray(parsed.search_queries)) {
                                rewrittenQueries = parsed.search_queries.slice(0, 2);
                            } else if (Array.isArray(parsed.queries)) {
                                rewrittenQueries = parsed.queries.slice(0, 2);
                            }
                        }
                    } catch (e) {
                        console.warn("Query rewriting failed, using original query:", e);
                    }

                    const queriesToSearch = [coreQuery, ...rewrittenQueries].slice(0, 3);
                    sendEvent("step", { message: `Searching across multiple sources...` });

                    // 2. Search the web
                    const searchPromises = queriesToSearch.map((q: string) => webSearch(q));
                    const searchResultsArrays = await Promise.all(searchPromises);
                    const flattenedResults = searchResultsArrays.flat();

                    // 3. Deduplicate
                    const uniqueUrls = new Map<string, SearchResult>();
                    for (const res of flattenedResults) {
                        if (res.url && !uniqueUrls.has(res.url)) {
                            uniqueUrls.set(res.url, res);
                        }
                        if (uniqueUrls.size >= 6) break;
                    }
                    const topSources = Array.from(uniqueUrls.values());
                    const topUrls = topSources.map((s) => s.url);

                    // Send sources early so frontend can render them
                    sendEvent("sources", { sources: topSources });

                    if (topUrls.length > 0) {
                        sendEvent("step", { message: `Found ${topUrls.length} sources. Reading content...` });
                    }

                    // 4. Parallel fetch with Jina Reader — emit each URL being read
                    const top3Urls = topUrls.slice(0, 3);
                    const jinaPromises = top3Urls.map(async (url: string) => {
                        const hostname = getHostname(url);
                        const fallbackSnippet = topSources.find(s => s.url === url)?.snippet || "";
                        sendEvent("reading_url", { url, hostname });

                        try {
                            const abortCtrl = new AbortController();
                            // 5s timeout is usually enough for Jina; faster fallback is better
                            const timeout = setTimeout(() => abortCtrl.abort(), 5000);

                            const res = await fetch(`https://r.jina.ai/${url}`, {
                                headers: {
                                    Accept: "text/plain",
                                    "X-Retain-Images": "none",
                                    "X-Return-Format": "text"
                                },
                                signal: abortCtrl.signal,
                            });
                            clearTimeout(timeout);

                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            const text = await res.text();

                            if (text.trim().length < 50) throw new Error("Content too short");

                            // Successfully read full page
                            sendEvent("read_complete", { url, hostname, success: true });
                            return { url, text };
                        } catch (err) {
                            // Fallback gracefully to search snippet
                            sendEvent("read_complete", { url, hostname, success: true }); // Mark success in UI since we have a snippet
                            return { url, text: fallbackSnippet };
                        }
                    });
                    const pagesContent = await Promise.all(jinaPromises);

                    // Also keep snippets as fallback
                    const snippetContent = topSources.map((s) => ({
                        url: s.url,
                        text: s.snippet || "",
                    }));

                    // 5. Chunk & score
                    const chunks: { url: string; text: string; score: number }[] = [];
                    const keywords = query
                        .toLowerCase()
                        .split(/\s+/)
                        .filter((w: string) => w.length > 3);

                    for (const { url, text } of pagesContent) {
                        if (!text || text.length < 50) continue;
                        const blocks = text.split(/\n\n+/);
                        let currentChunk = "";
                        for (const block of blocks) {
                            if (currentChunk.length + block.length > 2000) {
                                if (currentChunk.trim().length > 100) {
                                    let score = 0;
                                    const lc = currentChunk.toLowerCase();
                                    keywords.forEach((kw: string) => {
                                        if (lc.includes(kw)) score++;
                                    });
                                    chunks.push({ url, text: currentChunk.trim(), score });
                                }
                                currentChunk = block;
                            } else {
                                currentChunk += "\n\n" + block;
                            }
                        }
                        if (currentChunk.trim().length > 100) {
                            let score = 0;
                            const lc = currentChunk.toLowerCase();
                            keywords.forEach((kw: string) => {
                                if (lc.includes(kw)) score++;
                            });
                            chunks.push({ url, text: currentChunk.trim(), score });
                        }
                    }

                    // Snippets as fallback chunks
                    for (const { url, text } of snippetContent) {
                        if (text.length > 20) {
                            let score = 0;
                            const lc = text.toLowerCase();
                            keywords.forEach((kw: string) => {
                                if (lc.includes(kw)) score++;
                            });
                            chunks.push({ url, text, score: Math.max(score - 1, 0) });
                        }
                    }

                    const topChunks = chunks.sort((a, b) => b.score - a.score).slice(0, 8);

                    // 6. Build RAG prompt with numbered sources
                    let contextText = "";
                    topChunks.forEach((chunk) => {
                        const sourceIndex = topSources.findIndex((s) => s.url === chunk.url);
                        contextText += `[Source ${sourceIndex + 1}: ${getHostname(chunk.url)}]\n${chunk.text}\n\n`;
                    });

                    if (topChunks.length === 0 && topSources.length > 0) {
                        topSources.forEach((s, idx) => {
                            if (s.snippet) {
                                contextText += `[Source ${idx + 1}: ${getHostname(s.url)}]\n${s.snippet}\n\n`;
                            }
                        });
                    }

                    // Build a numbered source reference list
                    let sourceListText = "Available sources:\n";
                    topSources.forEach((s, idx) => {
                        sourceListText += `[${idx + 1}] ${s.title} — ${getHostname(s.url)}\n`;
                    });

                    const ragSystemPrompt = `You are Aetheron, a world-class AI research assistant. Your job is to provide comprehensive, well-structured, and insightful answers based on the provided sources.

## Instructions:
1. **Be thorough**: Write detailed, in-depth answers. Cover multiple aspects of the topic. Use paragraphs, headings (##), bullet points, and bold text for readability.
2. **Cite inline**: After each claim or piece of information, add a citation like [1], [2], etc. referencing the source number. Multiple citations can be grouped like [1][3].
3. **Structure well**: Use markdown formatting:
   - Use **## Headings** to organize sections
   - Use **bold** for key terms
   - Use bullet points or numbered lists for clarity
   - Use code blocks for technical content
4. **Be comprehensive**: Don't just summarize — explain, compare, and provide context. Aim for at least 300-500 words for complex topics.
5. **Be accurate**: Only state what the sources support. If sources don't fully answer the question, clearly state what is and isn't covered.

${sourceListText}

## Source Content:
${contextText}`;

                    sendEvent("step", { message: "Generating comprehensive answer..." });

                    // 7. Stream answer
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
                } catch (error: any) {
                    console.error("Stream execution error:", error);
                    sendEvent("error", { message: error.message || "An error occurred" });
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
