"use client";

import {
    useEffect,
    useState,
    useRef,
    useCallback,
    Suspense,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    Search,
    Loader2,
    Link as LinkIcon,
    MessageSquare,
    Quote,
    Copy,
    Check,
    Sun,
    Moon,
    ExternalLink,
    ChevronDown,
    Zap,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";

interface Source {
    title: string;
    url: string;
    favicon: string;
    snippet: string;
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

// Available Groq models with best free-tier limits
const MODELS = [
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", badge: "30K TPM" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "12K TPM" },
    { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2", badge: "10K TPM" },
    { id: "qwen/qwen3-32b", label: "Qwen 3 32B", badge: "6K TPM" },
];

function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const q = searchParams.get("q") || "";

    const [sources, setSources] = useState<Source[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [followUpInput, setFollowUpInput] = useState("");
    const [copied, setCopied] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [headerInput, setHeaderInput] = useState(q);

    const scrollRef = useRef<HTMLDivElement>(null);
    const hasSearched = useRef(false);
    const modelPickerRef = useRef<HTMLDivElement>(null);

    // Close model picker on outside click
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
                setShowModelPicker(false);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const streamSearch = useCallback(
        async (allMessages: Message[], model: string) => {
            setIsSearching(true);
            setIsStreaming(true);

            try {
                const res = await fetch("/api/search", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: allMessages.map((m) => ({
                            role: m.role,
                            content: m.content,
                        })),
                        model,
                    }),
                });

                if (!res.ok) throw new Error("Search failed");

                // Parse sources from header
                const sourcesHeader = res.headers.get("x-sources");
                if (sourcesHeader) {
                    try {
                        setSources(JSON.parse(decodeURIComponent(sourcesHeader)));
                    } catch {
                        /* skip */
                    }
                }
                setIsSearching(false);

                // Stream response body
                const reader = res.body?.getReader();
                if (!reader) return;

                const decoder = new TextDecoder();
                const assistantId = Date.now().toString() + "-a";
                setMessages((prev) => [
                    ...prev,
                    { id: assistantId, role: "assistant", content: "" },
                ]);

                let fullText = "";
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });

                    // ai SDK v6 UI message stream: SSE format with data: {"type":"text-delta","delta":"..."}
                    const lines = chunk.split("\n");
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(trimmed.slice(6));
                                if (data.type === "text-delta" && data.delta) {
                                    fullText += data.delta;
                                }
                            } catch {
                                /* skip non-JSON lines */
                            }
                        }
                    }

                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === assistantId ? { ...m, content: fullText } : m
                        )
                    );
                }
            } catch (error) {
                console.error("Stream error:", error);
                const errId = Date.now().toString() + "-err";
                setMessages((prev) => [
                    ...prev,
                    {
                        id: errId,
                        role: "assistant",
                        content:
                            "Sorry, something went wrong. Please check your connection and try again.",
                    },
                ]);
            } finally {
                setIsSearching(false);
                setIsStreaming(false);
            }
        },
        []
    );

    // Auto-search on initial load
    useEffect(() => {
        if (q && !hasSearched.current) {
            hasSearched.current = true;
            const userMsg: Message = {
                id: Date.now().toString(),
                role: "user",
                content: q,
            };
            setMessages([userMsg]);
            streamSearch([userMsg], selectedModel);
        }
    }, [q, streamSearch, selectedModel]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleHeaderSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = headerInput.trim();
        if (trimmed && trimmed !== q) {
            router.push(`/search?q=${encodeURIComponent(trimmed)}`);
        }
    };

    const handleFollowUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!followUpInput.trim() || isStreaming) return;
        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: followUpInput.trim(),
        };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setFollowUpInput("");
        await streamSearch(updatedMessages, selectedModel);
    };

    const copyAnswer = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const selectedModelLabel =
        MODELS.find((m) => m.id === selectedModel)?.label ?? "Model";

    const hostname = (url: string) => {
        try {
            return new URL(url).hostname.replace("www.", "");
        } catch {
            return url;
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-background">
            {/* ── HEADER ────────────────────────────────────────────── */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/40">
                <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
                    {/* Logo */}
                    <button
                        onClick={() => router.push("/")}
                        className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-violet-400 hover:opacity-80 transition-opacity shrink-0"
                    >
                        Perplix
                    </button>

                    {/* Search bar */}
                    <form onSubmit={handleHeaderSearch} className="relative flex-1 group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors pointer-events-none" />
                        <input
                            type="text"
                            value={headerInput}
                            onChange={(e) => setHeaderInput(e.target.value)}
                            placeholder="Search anything..."
                            className="w-full bg-muted/60 border border-border/50 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all"
                        />
                    </form>

                    {/* Model selector */}
                    <div className="relative shrink-0" ref={modelPickerRef}>
                        <button
                            onClick={() => setShowModelPicker((p) => !p)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-card border border-border/60 rounded-full hover:bg-accent transition-all"
                        >
                            <Zap className="w-3 h-3 text-amber-400" />
                            <span className="hidden sm:inline">{selectedModelLabel}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                        </button>

                        <AnimatePresence>
                            {showModelPicker && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 top-full mt-2 w-64 bg-card border border-border/60 rounded-2xl shadow-xl p-1.5 z-50"
                                >
                                    {MODELS.map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => {
                                                setSelectedModel(m.id);
                                                setShowModelPicker(false);
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${selectedModel === m.id
                                                ? "bg-blue-500/10 text-blue-400"
                                                : "hover:bg-accent text-foreground"
                                                }`}
                                        >
                                            <span className="text-sm font-medium">{m.label}</span>
                                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                                {m.badge}
                                            </span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Theme toggle */}
                    <button
                        onClick={toggleTheme}
                        className="shrink-0 p-2 rounded-full bg-card border border-border/60 hover:bg-accent transition-all"
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? (
                            <Sun className="w-4 h-4 text-amber-400" />
                        ) : (
                            <Moon className="w-4 h-4 text-blue-500" />
                        )}
                    </button>
                </div>
            </header>

            {/* ── MAIN ──────────────────────────────────────────────── */}
            <main className="flex-1 flex flex-col md:flex-row max-w-6xl mx-auto w-full p-4 md:p-6 gap-6 pb-36">
                {/* Answer column */}
                <div className="flex-1 min-w-0 overflow-y-auto" ref={scrollRef}>
                    {/* Initial loading state */}
                    {isSearching && messages.filter((m) => m.role === "assistant").length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-start gap-4 p-5 rounded-2xl border border-border/50 bg-card/50"
                        >
                            <div className="mt-0.5 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shrink-0">
                                <Loader2 className="w-4 h-4 text-white animate-spin" />
                            </div>
                            <div className="space-y-2 flex-1">
                                <p className="text-sm font-medium">Searching the web…</p>
                                <div className="space-y-1.5">
                                    {["Rewriting query with AI", "Fetching DuckDuckGo results", "Reading source pages with Jina"].map(
                                        (step, i) => (
                                            <motion.div
                                                key={step}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.4 }}
                                                className="flex items-center gap-2 text-xs text-muted-foreground"
                                            >
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                                {step}
                                            </motion.div>
                                        )
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <div className="space-y-5 mt-2">
                        <AnimatePresence>
                            {messages.map((m) => (
                                <motion.div
                                    key={m.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"
                                        }`}
                                >
                                    {m.role === "user" ? (
                                        <div className="bg-gradient-to-r from-blue-600 to-violet-600 text-white px-5 py-3 rounded-2xl max-w-[85%] shadow-lg shadow-blue-500/10 text-sm font-medium">
                                            {m.content}
                                        </div>
                                    ) : (
                                        <div className="bg-card border border-border/60 rounded-2xl px-6 py-5 w-full shadow-sm relative group/answer">
                                            {/* Copy button */}
                                            {m.content && (
                                                <button
                                                    onClick={() => copyAnswer(m.id, m.content)}
                                                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-muted/0 hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover/answer:opacity-100 transition-all"
                                                    title="Copy answer"
                                                >
                                                    {copied === m.id ? (
                                                        <Check className="w-3.5 h-3.5 text-green-500" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5" />
                                                    )}
                                                </button>
                                            )}

                                            <div className="prose prose-neutral dark:prose-invert prose-p:leading-relaxed prose-headings:font-semibold prose-a:text-blue-400 prose-code:text-blue-300 prose-code:bg-blue-500/10 prose-code:rounded prose-code:px-1 max-w-none text-[15px]">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({ node, ...props }: any) => {
                                                            const href = props.href || "";
                                                            if (href.startsWith("#source-")) {
                                                                const sourceId = href.split("-")[1];
                                                                return (
                                                                    <a
                                                                        href={`#source-card-${sourceId}`}
                                                                        className="inline-flex text-[10px] items-center justify-center w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 mx-0.5 no-underline font-bold transition-colors align-super"
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            document
                                                                                .getElementById(`source-card-${sourceId}`)
                                                                                ?.scrollIntoView({ behavior: "smooth" });
                                                                        }}
                                                                    >
                                                                        {sourceId}
                                                                    </a>
                                                                );
                                                            }
                                                            return (
                                                                <a
                                                                    {...props}
                                                                    className="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-500/30 hover:decoration-blue-400/50 transition-colors"
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                />
                                                            );
                                                        },
                                                    }}
                                                >
                                                    {m.content}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {/* Typing indicator */}
                        {isStreaming &&
                            messages.length > 0 &&
                            messages[messages.length - 1].role === "user" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="bg-card border border-border/60 px-6 py-5 rounded-2xl w-full flex items-center gap-3"
                                >
                                    <div className="flex gap-1">
                                        {[0, 150, 300].map((delay) => (
                                            <div
                                                key={delay}
                                                className="h-2 w-2 rounded-full bg-gradient-to-b from-blue-400 to-violet-400 animate-bounce"
                                                style={{ animationDelay: `${delay}ms` }}
                                            />
                                        ))}
                                    </div>
                                    <span className="text-sm text-muted-foreground">
                                        Generating answer with{" "}
                                        <span className="text-blue-400 font-medium">
                                            {selectedModelLabel}
                                        </span>
                                        …
                                    </span>
                                </motion.div>
                            )}
                    </div>
                </div>

                {/* ── SIDEBAR: Sources ──────────────────────────────── */}
                <aside className="w-full md:w-72 lg:w-80 shrink-0">
                    <AnimatePresence mode="wait">
                        {sources.length > 0 ? (
                            <motion.div
                                key="sources"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.4 }}
                            >
                                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Quote className="w-3.5 h-3.5 text-blue-400" />
                                    Sources
                                </h3>
                                <div className="flex flex-col gap-2">
                                    {sources.map((s, idx) => (
                                        <motion.a
                                            key={idx}
                                            id={`source-card-${idx + 1}`}
                                            href={s.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.07 }}
                                            className="flex flex-col p-3.5 bg-card hover:bg-accent/40 border border-border/60 hover:border-blue-500/20 rounded-xl transition-all group shadow-sm hover:shadow-md"
                                        >
                                            <div className="flex items-center gap-2 mb-2 overflow-hidden">
                                                <span className="bg-blue-500/10 text-blue-400 text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-bold shrink-0">
                                                    {idx + 1}
                                                </span>
                                                {s.favicon ? (
                                                    <img
                                                        src={s.favicon}
                                                        alt=""
                                                        className="w-3.5 h-3.5 rounded-sm shrink-0"
                                                    />
                                                ) : (
                                                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                )}
                                                <span className="text-[11px] text-muted-foreground truncate group-hover:text-foreground transition-colors">
                                                    {hostname(s.url)}
                                                </span>
                                                <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0 ml-auto group-hover:text-muted-foreground transition-colors" />
                                            </div>
                                            <h4 className="text-xs font-semibold line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">
                                                {s.title || "Untitled Source"}
                                            </h4>
                                            {s.snippet && (
                                                <p className="text-[11px] text-muted-foreground/70 line-clamp-2 mt-1 leading-relaxed">
                                                    {s.snippet}
                                                </p>
                                            )}
                                        </motion.a>
                                    ))}
                                </div>
                            </motion.div>
                        ) : isSearching ? (
                            <motion.div key="skeleton" className="space-y-3">
                                <div className="h-4 w-20 bg-muted rounded-full animate-pulse" />
                                {[1, 2, 3].map((i) => (
                                    <div
                                        key={i}
                                        className="h-24 bg-card rounded-xl animate-pulse border border-border/40"
                                    />
                                ))}
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </aside>
            </main>

            {/* ── FLOATING FOLLOW-UP BAR ────────────────────────── */}
            {messages.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
                    <div className="bg-gradient-to-t from-background via-background/95 to-transparent pt-12 pb-5 px-4">
                        <div className="max-w-3xl mx-auto pointer-events-auto">
                            <form
                                onSubmit={handleFollowUp}
                                className="relative flex items-center"
                            >
                                <input
                                    className="w-full bg-card/90 backdrop-blur-xl border border-border/60 focus:border-blue-500/40 text-foreground rounded-full pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 shadow-2xl transition-all placeholder:text-muted-foreground/50"
                                    value={followUpInput}
                                    onChange={(e) => setFollowUpInput(e.target.value)}
                                    placeholder={`Ask a follow-up…`}
                                    disabled={isStreaming}
                                />
                                <button
                                    type="submit"
                                    disabled={isStreaming || !followUpInput.trim()}
                                    className="absolute right-2 p-2.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-full disabled:opacity-40 hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-background">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                </div>
            }
        >
            <SearchContent />
        </Suspense>
    );
}
