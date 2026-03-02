import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { Plus, PanelLeftClose, Clock, MessageSquare, Trash2 } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────
export interface Source {
    title: string;
    url: string;
    favicon: string;
    snippet: string;
}

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

export interface ChatThread {
    id: string;
    title: string;
    messages: Message[];
    sources: Source[];
    createdAt: number;
    updatedAt: number;
}

export const STORAGE_KEY = "aetheron-chat-threads";

// ─── localStorage helpers ───────────────────────────────────
export function loadThreads(): ChatThread[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function saveThreads(threads: ChatThread[]) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
    } catch {
        // Storage full or unavailable
    }
}

export function saveThread(thread: ChatThread) {
    const threads = loadThreads();
    const idx = threads.findIndex((t) => t.id === thread.id);
    if (idx >= 0) {
        threads[idx] = thread;
    } else {
        threads.unshift(thread);
    }
    // Keep max 50 threads
    saveThreads(threads.slice(0, 50));
}

export function deleteThread(threadId: string) {
    const threads = loadThreads().filter((t) => t.id !== threadId);
    saveThreads(threads);
}

// ─── Sidebar Component ──────────────────────────────────────
export function Sidebar({
    threads,
    currentThreadId,
    isOpen,
    onToggle,
    onSelectThread,
    onNewThread,
    onDeleteThread,
}: {
    threads: ChatThread[];
    currentThreadId: string | null;
    isOpen: boolean;
    onToggle: () => void;
    onSelectThread: (thread: ChatThread) => void;
    onNewThread: () => void;
    onDeleteThread: (id: string) => void;
}) {
    const groupThreadsByDate = (threads: ChatThread[]) => {
        const now = Date.now();
        const day = 86400000;
        const groups: { label: string; threads: ChatThread[] }[] = [
            { label: "Today", threads: [] },
            { label: "Yesterday", threads: [] },
            { label: "Previous 7 Days", threads: [] },
            { label: "Older", threads: [] },
        ];

        threads.forEach((t) => {
            const age = now - t.updatedAt;
            if (age < day) groups[0].threads.push(t);
            else if (age < 2 * day) groups[1].threads.push(t);
            else if (age < 7 * day) groups[2].threads.push(t);
            else groups[3].threads.push(t);
        });

        return groups.filter((g) => g.threads.length > 0);
    };

    const groups = groupThreadsByDate(threads);

    return (
        <>
            {/* Mobile overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 z-40 md:hidden"
                        onClick={onToggle}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.aside
                        initial={{ x: -280, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -280, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed left-0 top-0 bottom-0 w-[280px] bg-card/95 backdrop-blur-xl border-r border-border/40 z-50 flex flex-col shadow-2xl shadow-black/10"
                    >
                        {/* Sidebar header */}
                        <div className="flex items-center justify-between p-4 border-b border-border/40">
                            <div className="flex items-center gap-2">
                                <Image src="/logo-mark.png" alt="Aetheron" width={24} height={24} className="rounded-md" />
                                <span className="text-sm font-bold text-foreground">History</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={onNewThread}
                                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                                    title="New thread"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={onToggle}
                                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
                                    title="Close sidebar"
                                >
                                    <PanelLeftClose className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Thread list */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-4">
                            {groups.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/50">
                                    <Clock className="w-8 h-8 mb-2 opacity-30" />
                                    <span className="text-xs">No history yet</span>
                                </div>
                            ) : (
                                groups.map((group) => (
                                    <div key={group.label}>
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 px-2 mb-1.5">
                                            {group.label}
                                        </p>
                                        <div className="space-y-0.5">
                                            {group.threads.map((thread) => (
                                                <div
                                                    key={thread.id}
                                                    className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${thread.id === currentThreadId
                                                        ? "bg-indigo-500/10 text-indigo-400"
                                                        : "hover:bg-accent text-foreground/80 hover:text-foreground"
                                                        }`}
                                                    onClick={() => onSelectThread(thread)}
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                                                    <span className="text-[13px] font-medium truncate flex-1">
                                                        {thread.title}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteThread(thread.id);
                                                        }}
                                                        className="p-1 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
                                                        title="Delete thread"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </>
    );
}
