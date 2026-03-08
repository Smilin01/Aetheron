"use client";

/* eslint-disable @next/next/no-img-element */

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
    Copy,
    Check,
    ArrowRight,
    ChevronDown,
    Globe2,
    Layers,
    Activity,
    CheckCircle2,
    XCircle,
    PanelLeftClose,
    PanelLeftOpen,
    Github,
    Zap,
    Microscope,
    FlaskConical,
    ExternalLink,
    Sun,
    Moon,
    Cpu,
    Hexagon,
    Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import Image from "next/image";

import {
    type Source,
    type Message,
    type ChatThread,
    Sidebar,
    loadThreads,
    saveThread,
    deleteThread,
} from "@/components/Sidebar";

// ─── Types ──────────────────────────────────────────────────
interface ProcessStep {
    type: "step" | "reading" | "read_done";
    message: string;
    url?: string;
    hostname?: string;
    success?: boolean;
    timestamp: number;
}

// ─── Search Modes ───────────────────────────────────────────
const SEARCH_MODES = [
    {
        id: "search",
        label: "Search",
        icon: Zap,
        description: "Quick answers",
        color: "text-blue-400",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/20",
    },
    {
        id: "research",
        label: "Research",
        icon: Microscope,
        description: "In-depth analysis",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        borderColor: "border-emerald-500/20",
    },
    {
        id: "deep_research",
        label: "Deep Research",
        icon: FlaskConical,
        description: "Multi-step research",
        color: "text-purple-400",
        bgColor: "bg-purple-500/10",
        borderColor: "border-purple-500/20",
    },
];

// ─── Custom AI Model Logos ──────────────────────────────────
const MetaLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
    </svg>
);

const AlibabaLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M3.996 4.517h5.291L8.01 6.324 4.153 7.506a1.668 1.668 0 0 0-1.165 1.601v5.786a1.668 1.668 0 0 0 1.165 1.6l3.857 1.183 1.277 1.807H3.996A3.996 3.996 0 0 1 0 15.487V8.513a3.996 3.996 0 0 1 3.996-3.996m16.008 0h-5.291l1.277 1.807 3.857 1.182c.715.227 1.17.889 1.165 1.601v5.786a1.668 1.668 0 0 1-1.165 1.6l-3.857 1.183-1.277 1.807h5.291A3.996 3.996 0 0 0 24 15.487V8.513a3.996 3.996 0 0 0-3.996-3.996m-4.007 8.345H8.002v-1.804h7.995Z" />
    </svg>
);

const MoonshotLogo = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
);

// Available Groq models
const MODELS = [
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", badge: "", icon: <MetaLogo className="w-3.5 h-3.5" /> },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "Pro", icon: <MetaLogo className="w-3.5 h-3.5" /> },
    { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2", badge: "Smart", icon: <MoonshotLogo className="w-3.5 h-3.5" /> },
    { id: "qwen/qwen3-32b", label: "Qwen 3 32B", badge: "", icon: <AlibabaLogo className="w-3.5 h-3.5" /> },
];

// ─── Inline Citation Component ──────────────────────────────
function CitationBadge({ sourceIndex, sources }: { sourceIndex: number; sources: Source[] }) {
    const [showPopup, setShowPopup] = useState(false);
    const source = sources[sourceIndex - 1];
    const popupRef = useRef<HTMLDivElement>(null);

    if (!source) {
        return (
            <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-bold mx-0.5 align-super cursor-default">
                {sourceIndex}
            </span>
        );
    }

    const hostname = (() => {
        try { return new URL(source.url).hostname.replace("www.", ""); }
        catch { return source.url; }
    })();

    return (
        <span
            className="relative inline-block"
            onMouseEnter={() => setShowPopup(true)}
            onMouseLeave={() => setShowPopup(false)}
        >
            <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[11px] font-semibold no-underline transition-all cursor-pointer align-baseline mx-0.5 border border-indigo-500/10 hover:border-indigo-500/25"
                onClick={(e) => e.stopPropagation()}
            >
                <span>{hostname}</span>
                <span className="text-[9px] opacity-60">+{sourceIndex}</span>
            </a>

            <AnimatePresence>
                {showPopup && (
                    <motion.span
                        ref={popupRef}
                        initial={{ opacity: 0, y: 4, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.96 }}
                        transition={{ duration: 0.15 }}
                        className="absolute left-0 top-full mt-2 w-80 bg-card/95 backdrop-blur-xl border border-border/60 rounded-xl shadow-2xl shadow-black/25 p-3.5 z-[100] pointer-events-auto flex flex-col"
                        style={{ minWidth: "280px" }}
                    >
                        <span className="flex items-center gap-2 mb-2">
                            <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {sourceIndex}
                            </span>
                            {source.favicon ? (
                                <img src={source.favicon} alt="" className="w-4 h-4 rounded-sm shrink-0" />
                            ) : (
                                <Globe2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-[11px] text-muted-foreground truncate">{hostname}</span>
                        </span>
                        <span className="text-sm font-semibold text-foreground leading-snug mb-1.5 line-clamp-2 block">
                            {source.title || "Untitled"}
                        </span>
                        {source.snippet && (
                            <span className="text-xs text-muted-foreground leading-relaxed line-clamp-3 mb-2 block">
                                {source.snippet}
                            </span>
                        )}
                        <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 no-underline font-medium transition-colors mt-auto"
                        >
                            Open source <ExternalLink className="w-3 h-3" />
                        </a>
                    </motion.span>
                )}
            </AnimatePresence>
        </span>
    );
}

// ─── Main Search Content ────────────────────────────────────
function SearchContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const q = searchParams.get("q") || "";
    const threadParam = searchParams.get("thread") || "";
    const modeParam = searchParams.get("mode") || "search";
    const modelParam = searchParams.get("model") || MODELS[0].id;

    const [sources, setSources] = useState<Source[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [followUpInput, setFollowUpInput] = useState("");
    const [copied, setCopied] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(modelParam);
    const [selectedMode, setSelectedMode] = useState(modeParam);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [showModePicker, setShowModePicker] = useState(false);
    const [headerInput, setHeaderInput] = useState(q);

    // Process state
    const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
    const [activeUrls, setActiveUrls] = useState<Map<string, { hostname: string; status: "reading" | "done" | "failed" }>>(new Map());
    const [isProcessOpen, setIsProcessOpen] = useState(true);

    // Sidebar & thread state
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [threads, setThreads] = useState<ChatThread[]>([]);
    const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);

    const scrollRef = useRef<HTMLDivElement>(null);
    const hasSearched = useRef(false);
    const modelPickerRef = useRef<HTMLDivElement>(null);
    const modePickerRef = useRef<HTMLDivElement>(null);

    // Load threads from localStorage on mount
    useEffect(() => {
        setThreads(loadThreads());
    }, []);

    // Close dropdowns on outside click
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
                setShowModelPicker(false);
            }
            if (modePickerRef.current && !modePickerRef.current.contains(e.target as Node)) {
                setShowModePicker(false);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Save current thread to localStorage whenever messages/sources change
    useEffect(() => {
        if (currentThreadId && messages.length > 0) {
            const firstUserMsg = messages.find((m) => m.role === "user");
            const title = firstUserMsg?.content.slice(0, 60) || "New Thread";
            const currentThreads = loadThreads();
            const thread: ChatThread = {
                id: currentThreadId,
                title,
                messages,
                sources,
                createdAt: currentThreads.find((t) => t.id === currentThreadId)?.createdAt || Date.now(),
                updatedAt: Date.now(),
            };
            saveThread(thread);
            setThreads(loadThreads());
        }
    }, [messages, sources, currentThreadId]);

    // Load a thread from URL param
    useEffect(() => {
        if (threadParam && !hasSearched.current) {
            const thread = loadThreads().find((t) => t.id === threadParam);
            if (thread) {
                setCurrentThreadId(thread.id);
                setMessages(thread.messages);
                setSources(thread.sources);
                setHeaderInput(thread.title);
                hasSearched.current = true;
                return;
            }
        }
    }, [threadParam]);

    const streamSearch = useCallback(
        async (allMessages: Message[], model: string, mode: string) => {
            setIsSearching(true);
            setIsStreaming(true);
            setProcessSteps([]);
            setActiveUrls(new Map());
            setIsProcessOpen(true);
            setSources([]);

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
                        mode,
                    }),
                });

                if (!res.ok) throw new Error("Search failed");

                const reader = res.body?.getReader();
                if (!reader) return;

                const decoder = new TextDecoder();
                const assistantId = Date.now().toString() + "-a";
                setMessages((prev) => [
                    ...prev,
                    { id: assistantId, role: "assistant", content: "" },
                ]);

                let fullText = "";
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const parts = buffer.split("\n\n");
                    buffer = parts.pop() || "";

                    for (const part of parts) {
                        const lines = part.split("\n");
                        for (const line of lines) {
                            if (line.startsWith("data: ")) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    if (data.type === "step") {
                                        setProcessSteps((prev) => {
                                            if (prev.length > 0 && prev[prev.length - 1].message === data.message) return prev;
                                            return [...prev, { type: "step", message: data.message, timestamp: Date.now() }];
                                        });
                                    } else if (data.type === "reading_url") {
                                        setActiveUrls((prev) => {
                                            const next = new Map(prev);
                                            next.set(data.url, { hostname: data.hostname, status: "reading" });
                                            return next;
                                        });
                                        setProcessSteps((prev) => [
                                            ...prev,
                                            { type: "reading", message: `Reading ${data.hostname}...`, url: data.url, hostname: data.hostname, timestamp: Date.now() }
                                        ]);
                                    } else if (data.type === "read_complete") {
                                        setActiveUrls((prev) => {
                                            const next = new Map(prev);
                                            next.set(data.url, { hostname: data.hostname, status: data.success ? "done" : "failed" });
                                            return next;
                                        });
                                    } else if (data.type === "sources") {
                                        setSources(data.sources);
                                    } else if (data.type === "text-delta" && data.delta) {
                                        setIsProcessOpen(false);
                                        fullText += data.delta;
                                        setMessages((prev) =>
                                            prev.map((m) =>
                                                m.id === assistantId ? { ...m, content: fullText } : m
                                            )
                                        );
                                    } else if (data.type === "error") {
                                        console.error("Server streaming error:", data.message);
                                    }
                                } catch {
                                    /* skip non-JSON lines */
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error("Stream error:", error);
                const errId = Date.now().toString() + "-err";
                setMessages((prev) => [
                    ...prev,
                    {
                        id: errId,
                        role: "assistant",
                        content: "Sorry, something went wrong. Please check your connection and try again.",
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
            const threadId = Date.now().toString();
            setCurrentThreadId(threadId);
            const userMsg: Message = {
                id: Date.now().toString(),
                role: "user",
                content: q,
            };
            setMessages([userMsg]);
            streamSearch([userMsg], selectedModel, selectedMode);
        }
    }, [q, streamSearch, selectedModel]);

    // Auto-scroll to bottom of the page when new messages arrive
    useEffect(() => {
        if (isStreaming) {
            // Use requestAnimationFrame to let the browser paint the new DOM nodes first
            requestAnimationFrame(() => {
                window.scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: "smooth" // smooth for better UX
                });
            });
        }
    }, [messages, isStreaming]);

    const handleHeaderSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = headerInput.trim();
        if (trimmed && trimmed !== q) {
            router.push(`/search?q=${encodeURIComponent(trimmed)}&mode=${selectedMode}&model=${encodeURIComponent(selectedModel)}`);
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
        await streamSearch(updatedMessages, selectedModel, selectedMode);
    };

    const copyAnswer = (id: string, content: string) => {
        navigator.clipboard.writeText(content);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleSelectThread = (thread: ChatThread) => {
        setCurrentThreadId(thread.id);
        setMessages(thread.messages);
        setSources(thread.sources);
        setHeaderInput(thread.title);
        hasSearched.current = true;
        setProcessSteps([]);
        setActiveUrls(new Map());
        setIsProcessOpen(false);
        setSidebarOpen(false);
        // Update URL without triggering a new search
        window.history.replaceState(null, "", `/search?thread=${thread.id}`);
    };

    const handleNewThread = () => {
        setSidebarOpen(false);
        router.push("/");
    };

    const handleDeleteThread = (id: string) => {
        deleteThread(id);
        setThreads(loadThreads());
        if (id === currentThreadId) {
            handleNewThread();
        }
    };

    const selectedModelLabel =
        MODELS.find((m) => m.id === selectedModel)?.label ?? "Model";
    const currentMode = SEARCH_MODES.find((m) => m.id === selectedMode) || SEARCH_MODES[0];
    const ModeIcon = currentMode.icon;

    const hostname = (url: string) => {
        try {
            return new URL(url).hostname.replace("www.", "");
        } catch {
            return url;
        }
    };

    // Parse citations in content → render CitationBadge components inline
    const renderCitedMarkdown = (content: string, msgSources: Source[]) => {
        return (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    p: ({ children }: any) => {
                        const processed = processChildrenForCitations(children, msgSources);
                        return <p>{processed}</p>;
                    },
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    li: ({ children, ...props }: any) => {
                        const processed = processChildrenForCitations(children, msgSources);
                        return <li {...props}>{processed}</li>;
                    },
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                    a: ({ node, ...props }: any) => {
                        return (
                            <a
                                {...props}
                                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-500/30 hover:decoration-indigo-400/50 transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                            />
                        );
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        );
    };

    const processChildrenForCitations = (children: React.ReactNode, msgSources: Source[]): React.ReactNode => {
        if (!children) return children;
        const result: React.ReactNode[] = [];
        const childArray = Array.isArray(children) ? children : [children];
        childArray.forEach((child, idx) => {
            if (typeof child === "string") {
                const parts = child.split(/(\[\d+\])/g);
                parts.forEach((part, partIdx) => {
                    const citationMatch = part.match(/^\[(\d+)\]$/);
                    if (citationMatch) {
                        const sourceNum = parseInt(citationMatch[1]);
                        result.push(
                            <CitationBadge
                                key={`cite-${idx}-${partIdx}-${sourceNum}`}
                                sourceIndex={sourceNum}
                                sources={msgSources}
                            />
                        );
                    } else if (part) {
                        result.push(part);
                    }
                });
            } else {
                result.push(child);
            }
        });
        return result;
    };

    return (
        <div className="flex min-h-screen bg-background">
            {/* ── SIDEBAR ─────────────────────────────────────────── */}
            <Sidebar
                threads={threads}
                currentThreadId={currentThreadId}
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(false)}
                onSelectThread={handleSelectThread}
                onNewThread={handleNewThread}
                onDeleteThread={handleDeleteThread}
            />

            {/* ── MAIN LAYOUT ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* ── HEADER ────────────────────────────────────────── */}
                <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/40">
                    <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-3">
                        {/* Sidebar toggle */}
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="shrink-0 p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                            title={sidebarOpen ? "Close history" : "Open history"}
                        >
                            {sidebarOpen ? (
                                <PanelLeftClose className="w-5 h-5" />
                            ) : (
                                <PanelLeftOpen className="w-5 h-5" />
                            )}
                        </button>

                        {/* Logo */}
                        <button
                            onClick={() => router.push("/")}
                            className="hover:opacity-80 transition-opacity shrink-0 flex items-center"
                        >
                            <Image
                                src="/logo-dark.png"
                                alt="Aetheron"
                                width={120}
                                height={32}
                                className="object-contain dark:hidden"
                                priority
                            />
                            <Image
                                src="/logo-light.png"
                                alt="Aetheron"
                                width={120}
                                height={32}
                                className="object-contain hidden dark:block"
                                priority
                            />
                        </button>

                        {/* Search bar */}
                        <form onSubmit={handleHeaderSearch} className="relative flex-1 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-400 transition-colors pointer-events-none" />
                            <input
                                type="text"
                                value={headerInput}
                                onChange={(e) => setHeaderInput(e.target.value)}
                                placeholder="Search anything..."
                                className="w-full bg-card/60 backdrop-blur-md border border-border/40 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/40 transition-all shadow-inner"
                            />
                        </form>

                        {/* Mode selector */}
                        <div className="relative shrink-0" ref={modePickerRef}>
                            <button
                                onClick={() => { setShowModePicker((p) => !p); setShowModelPicker(false); }}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                            >
                                <ModeIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">{currentMode.label === 'Search' ? 'Focus' : currentMode.label}</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>

                            <AnimatePresence>
                                {showModePicker && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-full mt-2 w-72 bg-popover text-popover-foreground border border-border shadow-2xl rounded-2xl p-2 z-50 overflow-hidden"
                                    >
                                        <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                            Focus
                                        </div>
                                        {SEARCH_MODES.map((mode) => {
                                            const Icon = mode.icon;
                                            return (
                                                <button
                                                    key={mode.id}
                                                    onClick={() => {
                                                        setSelectedMode(mode.id);
                                                        setShowModePicker(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${selectedMode === mode.id
                                                        ? "bg-accent"
                                                        : "hover:bg-accent/50"
                                                        }`}
                                                >
                                                    <Icon className={`w-5 h-5 ${selectedMode === mode.id ? "text-foreground" : "text-muted-foreground"}`} />
                                                    <div className="flex flex-col flex-1">
                                                        <span className="text-sm font-medium">{mode.label}</span>
                                                        <span className="text-[11px] text-muted-foreground line-clamp-1">{mode.description}</span>
                                                    </div>
                                                    {selectedMode === mode.id && (
                                                        <Check className="w-4 h-4 text-foreground" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Model selector */}
                        <div className="relative shrink-0" ref={modelPickerRef}>
                            <button
                                onClick={() => { setShowModelPicker((p) => !p); setShowModePicker(false); }}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                            >
                                <Layers className="w-4 h-4" />
                                <span className="hidden sm:inline">{selectedModelLabel}</span>
                                <span className="sm:hidden">{selectedModelLabel}</span>
                                <ChevronDown className="w-3 h-3 opacity-50" />
                            </button>

                            <AnimatePresence>
                                {showModelPicker && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute right-0 top-full mt-2 w-72 bg-popover text-popover-foreground border border-border shadow-2xl rounded-2xl p-2 z-50 overflow-hidden"
                                    >
                                        <div className="px-2 pb-2 mb-2 border-b border-border/50">
                                            <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium text-sm hover:bg-teal-500/20 transition-colors cursor-pointer">
                                                <span>Upgrade for best models</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                        {MODELS.map((m) => (
                                            <button
                                                key={m.id}
                                                onClick={() => {
                                                    setSelectedModel(m.id);
                                                    setShowModelPicker(false);
                                                }}
                                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${selectedModel === m.id
                                                    ? "bg-accent"
                                                    : "hover:bg-accent/50"
                                                    }`}
                                            >
                                                <div className="flex items-center justify-center shrink-0 w-6 h-6 border border-border/50 rounded bg-background/50 shadow-sm text-foreground/80">
                                                    {m.icon}
                                                </div>
                                                <div className="flex flex-col flex-1 pl-1">
                                                    <span className="text-sm font-medium">{m.label}</span>
                                                </div>
                                                {m.badge && (
                                                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-2">
                                                        {m.badge}
                                                    </span>
                                                )}
                                                {selectedModel === m.id && (
                                                    <Check className="w-4 h-4 text-foreground ml-2" />
                                                )}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Github repo */}
                        <a
                            href="https://github.com/Smilin01/Aetheron"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-2 rounded-full bg-card border border-border/60 hover:bg-accent transition-all text-muted-foreground hover:text-foreground"
                            aria-label="GitHub Repository"
                        >
                            <Github className="w-4 h-4" />
                        </a>

                        {/* Theme toggle */}
                        <button
                            onClick={toggleTheme}
                            className="shrink-0 p-2 rounded-full bg-card border border-border/60 hover:bg-accent transition-all text-muted-foreground hover:text-foreground"
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

                {/* ── MAIN CONTENT ──────────────────────────────────── */}
                <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-4 md:p-6 gap-6 pb-[200px]">
                    <div className="flex-1 min-w-0 flex flex-col gap-6" ref={scrollRef}>
                        {/* ── LIVE PROCESS INDICATOR ───────────────── */}
                        <AnimatePresence>
                            {processSteps.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: "auto" }}
                                    exit={{ opacity: 0, height: 0, margin: 0 }}
                                    className="mb-2 overflow-hidden"
                                >
                                    <div className="border border-border/40 bg-card/40 backdrop-blur-md rounded-2xl shadow-sm overflow-hidden">
                                        <button
                                            onClick={() => setIsProcessOpen(!isProcessOpen)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-accent/40 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSearching ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                                                    {isSearching ? (
                                                        <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-start">
                                                    <span className="text-sm font-semibold text-foreground">
                                                        {isSearching ? "Researching..." : "Research complete"}
                                                    </span>
                                                    {isSearching && processSteps.length > 0 && (
                                                        <span className="text-[11px] text-muted-foreground">
                                                            {processSteps[processSteps.length - 1].message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${isProcessOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {isProcessOpen && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-border/40 bg-background/30"
                                                >
                                                    <div className="p-4 space-y-2">
                                                        {processSteps.map((step, i) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ opacity: 0, x: -10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: i * 0.02 }}
                                                                className="flex items-center gap-3"
                                                            >
                                                                {step.type === "reading" ? (
                                                                    <>
                                                                        <div className="w-5 h-5 rounded-md bg-indigo-500/10 flex items-center justify-center shrink-0">
                                                                            {activeUrls.get(step.url || "")?.status === "reading" ? (
                                                                                <Loader2 className="w-3 h-3 text-indigo-400 animate-spin" />
                                                                            ) : activeUrls.get(step.url || "")?.status === "done" ? (
                                                                                <Check className="w-3 h-3 text-emerald-400" />
                                                                            ) : (
                                                                                <XCircle className="w-3 h-3 text-red-400" />
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <Globe2 className="w-3 h-3 text-indigo-400/70 shrink-0" />
                                                                            <span className="text-xs text-foreground/80 font-medium truncate">
                                                                                {step.hostname}
                                                                            </span>
                                                                            {activeUrls.get(step.url || "")?.status === "reading" && (
                                                                                <span className="text-[10px] text-indigo-400/60 animate-pulse">reading...</span>
                                                                            )}
                                                                            {activeUrls.get(step.url || "")?.status === "done" && (
                                                                                <span className="text-[10px] text-emerald-400/60">done</span>
                                                                            )}
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0">
                                                                            <Activity className="w-3 h-3 text-muted-foreground/50" />
                                                                        </div>
                                                                        <span className="text-xs text-muted-foreground">
                                                                            {step.message}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── SOURCES BAR ──────────────────────────── */}
                        <AnimatePresence>
                            {sources.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="mb-2"
                                >
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                            <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                        </div>
                                        <span className="text-sm font-bold text-foreground">{sources.length} Sources</span>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {sources.map((s, idx) => (
                                            <motion.a
                                                key={idx}
                                                id={`source-card-${idx + 1}`}
                                                href={s.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                initial={{ opacity: 0, x: 10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: idx * 0.04 }}
                                                className="flex flex-col min-w-[200px] max-w-[220px] p-3 bg-card/50 backdrop-blur-sm hover:bg-card/80 border border-border/40 hover:border-indigo-500/30 rounded-xl transition-all group shadow-sm hover:shadow-md shrink-0"
                                            >
                                                <div className="flex items-center gap-1.5 mb-1.5">
                                                    <span className="bg-indigo-500/10 text-indigo-400 text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    {s.favicon ? (
                                                        <img src={s.favicon} alt="" className="w-3 h-3 rounded-sm shrink-0" />
                                                    ) : (
                                                        <LinkIcon className="w-3 h-3 text-muted-foreground shrink-0" />
                                                    )}
                                                    <span className="text-[10px] text-muted-foreground truncate group-hover:text-foreground transition-colors">
                                                        {hostname(s.url)}
                                                    </span>
                                                    <ExternalLink className="w-2.5 h-2.5 text-muted-foreground/30 shrink-0 ml-auto group-hover:text-muted-foreground transition-colors" />
                                                </div>
                                                <h4 className="text-[11px] font-semibold line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">
                                                    {s.title || "Untitled Source"}
                                                </h4>
                                            </motion.a>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* ── MESSAGES ─────────────────────────────── */}
                        <div className="space-y-5">
                            <AnimatePresence>
                                {messages.map((m) => (
                                    <motion.div
                                        key={m.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                                    >
                                        {m.role === "user" ? (
                                            <div className="bg-foreground text-background px-5 py-3.5 rounded-2xl max-w-[85%] shadow-lg shadow-foreground/5 text-[15px] font-medium leading-relaxed">
                                                {m.content}
                                            </div>
                                        ) : (
                                            <div className="bg-card/40 backdrop-blur-sm border border-border/40 rounded-3xl px-6 py-6 w-full shadow-sm relative group/answer">
                                                {/* Aetheron badge */}
                                                <div className="flex items-center gap-2 mb-4">
                                                    <Image
                                                        src="/logo-mark.png"
                                                        alt="Aetheron"
                                                        width={40}
                                                        height={40}
                                                        className="rounded-md"
                                                    />
                                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Answer</span>
                                                </div>

                                                {/* Copy button */}
                                                {m.content && (
                                                    <button
                                                        onClick={() => copyAnswer(m.id, m.content)}
                                                        className="absolute top-4 right-4 p-1.5 rounded-lg bg-muted/0 hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover/answer:opacity-100 transition-all"
                                                        title="Copy answer"
                                                    >
                                                        {copied === m.id ? (
                                                            <Check className="w-3.5 h-3.5 text-green-500" />
                                                        ) : (
                                                            <Copy className="w-3.5 h-3.5" />
                                                        )}
                                                    </button>
                                                )}

                                                <div className="prose prose-neutral dark:prose-invert prose-p:leading-relaxed prose-headings:font-semibold prose-a:text-indigo-400 prose-code:text-indigo-300 prose-code:bg-indigo-500/10 prose-code:rounded prose-code:px-1 max-w-none text-[15px] prose-h2:text-lg prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-ul:my-2 prose-li:my-0.5">
                                                    {renderCitedMarkdown(m.content, sources)}
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
                                        className="bg-card/40 border border-border/40 px-6 py-5 rounded-2xl w-full flex items-center gap-3"
                                    >
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="shrink-0"
                                        >
                                            <Image src="/logo-mark.png" alt="" width={20} height={20} className="rounded-sm opacity-80" />
                                        </motion.div>
                                        <span className="text-sm text-muted-foreground font-medium">
                                            Thinking with{" "}
                                            <span className="text-indigo-400 font-semibold">
                                                {selectedModelLabel}
                                            </span>
                                            …
                                        </span>
                                    </motion.div>
                                )}
                        </div>
                        {/* Spacer to allow scrolling past the floating input bar */}
                        <div className="h-40 shrink-0 pointer-events-none w-full" />
                    </div>
                </main>

                {/* ── FLOATING FOLLOW-UP BAR ───────────────────────── */}
                {messages.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none">
                        <div className="bg-gradient-to-t from-background via-background/95 to-transparent pt-12 pb-5 px-4">
                            <div className="max-w-3xl mx-auto pointer-events-auto">
                                <form
                                    onSubmit={handleFollowUp}
                                    className="relative flex items-center"
                                >
                                    <input
                                        className="w-full bg-card/80 backdrop-blur-xl border border-border/40 text-foreground rounded-full pl-6 pr-14 py-4 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 shadow-2xl transition-all placeholder:text-muted-foreground/40"
                                        value={followUpInput}
                                        onChange={(e) => setFollowUpInput(e.target.value)}
                                        placeholder="Ask a follow-up…"
                                        disabled={isStreaming}
                                    />
                                    <button
                                        type="submit"
                                        disabled={isStreaming || !followUpInput.trim()}
                                        className="absolute right-2 p-3 bg-foreground text-background rounded-full disabled:opacity-20 hover:bg-foreground/90 transition-all shadow-lg shadow-foreground/10 disabled:shadow-none"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen items-center justify-center bg-background">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                        <Image src="/logo-mark.png" alt="Loading" width={32} height={32} className="opacity-70" />
                    </motion.div>
                </div>
            }
        >
            <SearchContent />
        </Suspense>
    );
}
