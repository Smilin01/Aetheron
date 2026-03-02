import { streamText, generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export const maxDuration = 60;

// Groq via OpenAI-compatible API
const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
});

// Fast model for query rewriting (14.4K RPD — highest daily limit)
const rewriteModel = groq(process.env.REWRITE_MODEL || "llama-3.1-8b-instant");
// High-quality model for answer generation (30K TPM — highest throughput)
const answerModel = groq(process.env.ANSWER_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct");

interface DuckDuckGoResult {
    title: string;
    url: string;
    favicon: string;
    snippet: string;
}

async function searchDuckDuckGo(query: string): Promise<DuckDuckGoResult[]> {
    const res = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    if (!res.ok) return [];
    const data = await res.json();

    const results: DuckDuckGoResult[] = [];

    // Add abstract source if available
    if (data.AbstractURL && data.Abstract) {
        results.push({
            title: data.Heading || data.AbstractSource || "Source",
            url: data.AbstractURL,
            favicon: data.Image ? `https://duckduckgo.com${data.Image}` : "",
            snippet: data.Abstract,
        });
    }

    // Add related topics (contain URLs + descriptions)
    if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics) {
            if (topic.FirstURL && topic.Text) {
                results.push({
                    title: topic.Text.split(" - ")[0]?.substring(0, 80) || "Related",
                    url: topic.FirstURL,
                    favicon: topic.Icon?.URL
                        ? `https://duckduckgo.com${topic.Icon.URL}`
                        : "",
                    snippet: topic.Text,
                });
            }
            // Handle sub-topics (grouped)
            if (topic.Topics) {
                for (const sub of topic.Topics) {
                    if (sub.FirstURL && sub.Text) {
                        results.push({
                            title: sub.Text.split(" - ")[0]?.substring(0, 80) || "Related",
                            url: sub.FirstURL,
                            favicon: sub.Icon?.URL
                                ? `https://duckduckgo.com${sub.Icon.URL}`
                                : "",
                            snippet: sub.Text,
                        });
                    }
                }
            }
        }
    }

    // Add direct results
    if (data.Results) {
        for (const r of data.Results) {
            if (r.FirstURL && r.Text) {
                results.push({
                    title: r.Text.split(" - ")[0]?.substring(0, 80) || "Result",
                    url: r.FirstURL,
                    favicon: r.Icon?.URL
                        ? `https://duckduckgo.com${r.Icon.URL}`
                        : "",
                    snippet: r.Text,
                });
            }
        }
    }

    return results;
}

export async function POST(req: Request) {
    try {
        const { messages, model: requestedModel } = await req.json();
        // Use model from request if provided, else fallback to env default
        const selectedAnswerModel = groq(requestedModel || process.env.ANSWER_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct");
        const latestMessage = messages[messages.length - 1];
        const query = latestMessage.content;

        // 1. Rewrite query using fast model (llama-3.1-8b-instant)
        //    Using generateText instead of generateObject since llama-3.1-8b-instant
        //    doesn't support json_schema structured outputs on Groq
        let rewrittenQueries: string[] = [];
        try {
            const { text: rewriteResult } = await generateText({
                model: rewriteModel,
                system:
                    'Rewrite the user\'s query into 2 distinct, highly optimized search queries. Respond with ONLY a JSON object in this exact format: {"queries": ["query1", "query2"]}. No other text.',
                prompt: query,
            });
            // Parse JSON from the response
            const jsonMatch = rewriteResult.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (Array.isArray(parsed.queries)) {
                    rewrittenQueries = parsed.queries.slice(0, 2);
                }
            }
        } catch {
            // Fallback: just use the original query if rewriting fails
            console.warn("Query rewriting failed, using original query");
        }

        const queriesToSearch = [query, ...rewrittenQueries].slice(0, 3);

        // 2. Hit DuckDuckGo for each query
        const searchPromises = queriesToSearch.map((q: string) =>
            searchDuckDuckGo(q)
        );
        const searchResultsArrays = await Promise.all(searchPromises);
        const flattenedResults = searchResultsArrays.flat();

        // 3. Deduplicate URLs, take top 5
        const uniqueUrls = new Map<string, DuckDuckGoResult>();
        for (const res of flattenedResults) {
            if (res.url && !uniqueUrls.has(res.url)) {
                uniqueUrls.set(res.url, res);
            }
            if (uniqueUrls.size >= 5) break;
        }
        const topSources = Array.from(uniqueUrls.values());
        const topUrls = topSources.map((s) => s.url);

        // 4. Parallel fetch with Jina Reader for top 3 URLs
        const top3Urls = topUrls.slice(0, 3);
        const jinaPromises = top3Urls.map(async (url: string) => {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 8000);
                const res = await fetch(`https://r.jina.ai/${url}`, {
                    headers: { Accept: "text/plain" },
                    signal: controller.signal,
                });
                clearTimeout(timeout);
                const text = await res.text();
                return { url, text };
            } catch {
                return { url, text: "" };
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

        const topChunks = chunks.sort((a, b) => b.score - a.score).slice(0, 5);

        // 6. Build RAG prompt
        let contextText = "";
        topChunks.forEach((chunk) => {
            const sourceIndex = topSources.findIndex((s) => s.url === chunk.url);
            contextText += `[${sourceIndex + 1}] ${chunk.url}\n${chunk.text}\n\n`;
        });

        if (topChunks.length === 0 && topSources.length > 0) {
            topSources.forEach((s, idx) => {
                if (s.snippet) {
                    contextText += `[${idx + 1}] ${s.url}\n${s.snippet}\n\n`;
                }
            });
        }

        const ragSystemPrompt = `You are a search assistant. Answer using ONLY the sources below. Cite inline like [1]. Be concise and accurate. If you cannot answer from the sources, say so.\n\n${contextText}`;

        // 7. Stream answer using high-quality model (llama-4-scout)
        const result = await streamText({
            model: selectedAnswerModel,
            system: ragSystemPrompt,
            messages: messages,
        });

        return result.toUIMessageStreamResponse({
            headers: {
                "x-sources": encodeURIComponent(JSON.stringify(topSources)),
            },
        });
    } catch (error) {
        console.error("Search API Error:", error);
        return new Response(
            JSON.stringify({ error: "Failed to search. Please try again." }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
}
