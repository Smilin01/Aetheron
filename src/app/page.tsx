"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, BookOpen, Globe, ArrowRight, Sun, Moon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import Image from "next/image";

import {
  type ChatThread,
  Sidebar,
  loadThreads,
  deleteThread,
} from "@/components/Sidebar";

export default function Home() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);

  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    setThreads(loadThreads());
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSelectThread = (thread: ChatThread) => {
    router.push(`/search?thread=${thread.id}`);
  };

  const handleDeleteThread = (id: string) => {
    deleteThread(id);
    setThreads(loadThreads());
  };

  const suggestions = [
    {
      text: "What are the latest advancements in quantum computing?",
      icon: <Sparkles className="w-4 h-4" />,
      color: "from-amber-500/20 to-orange-500/20",
      iconColor: "text-amber-400",
    },
    {
      text: "How does the Vercel AI SDK work?",
      icon: <BookOpen className="w-4 h-4" />,
      color: "from-blue-500/20 to-cyan-500/20",
      iconColor: "text-blue-400",
    },
    {
      text: "Explain RAG (Retrieval-Augmented Generation)",
      icon: <Globe className="w-4 h-4" />,
      color: "from-violet-500/20 to-purple-500/20",
      iconColor: "text-violet-400",
    },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <Sidebar
        threads={threads}
        currentThreadId={null}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        onSelectThread={handleSelectThread}
        onNewThread={() => setSidebarOpen(false)}
        onDeleteThread={handleDeleteThread}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-24 relative overflow-hidden bg-background">
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-6 left-6 z-20 p-2.5 rounded-full bg-card/40 backdrop-blur-md border border-border/40 hover:bg-accent transition-all shadow-sm hover:shadow-md text-muted-foreground hover:text-foreground"
          aria-label={sidebarOpen ? "Close history" : "Open history"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeftOpen className="w-5 h-5" />
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 z-20 p-2.5 rounded-full bg-card/40 backdrop-blur-md border border-border/40 hover:bg-accent transition-all shadow-sm hover:shadow-md text-muted-foreground hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-zinc-900" />
          )}
        </button>

        {/* Ambient premium background glow */}
        <div className="absolute top-[10%] left-[20%] w-[600px] h-[600px] rounded-full bg-indigo-500/[0.04] blur-[150px] pointer-events-none" />
        <div className="absolute bottom-[20%] right-[10%] w-[500px] h-[500px] rounded-full bg-fuchsia-500/[0.04] blur-[150px] pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="z-10 w-full max-w-3xl flex flex-col items-center space-y-12"
        >
          {/* Logo */}
          <div className="flex flex-col items-center space-y-4 mb-2">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="flex flex-col items-center justify-center"
            >
              <Image
                src="/logo-dark.png"
                alt="Aetheron"
                width={280}
                height={80}
                className="object-contain dark:hidden"
                priority
              />
              <Image
                src="/logo-light.png"
                alt="Aetheron"
                width={280}
                height={80}
                className="object-contain hidden dark:block"
                priority
              />
            </motion.div>
            <p className="text-muted-foreground/80 text-center text-base md:text-lg font-medium max-w-md mt-4">
              The intelligent way to explore the web. Discover knowledge at the speed of thought.
            </p>
          </div>

          {/* Search Input */}
          <form onSubmit={handleSearch} className="w-full relative group">
            <motion.div
              animate={{
                boxShadow: isFocused
                  ? "0 0 0 1px rgba(99, 102, 241, 0.2), 0 20px 60px -15px rgba(0, 0, 0, 0.4)"
                  : "0 4px 30px -10px rgba(0, 0, 0, 0.15)",
                scale: isFocused ? 1.01 : 1,
              }}
              transition={{ duration: 0.2 }}
              className="relative rounded-full"
            >
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-indigo-400 transition-colors duration-300">
                <Search className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Ask anything..."
                className="w-full p-5 md:p-6 pl-14 pr-32 text-base md:text-lg bg-card/60 backdrop-blur-xl border border-border/40 rounded-full focus:outline-none focus:border-indigo-500/40 transition-all placeholder:text-muted-foreground/40 shadow-inner"
                autoFocus
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="absolute inset-y-2.5 right-2.5 px-6 bg-foreground text-background font-semibold rounded-full hover:bg-foreground/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-lg shadow-foreground/10 disabled:shadow-none flex items-center gap-2"
              >
                <span className="hidden sm:inline">Search</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </form>

          {/* Suggestion Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full max-w-3xl">
            {suggestions.map((suggestion, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: "easeOut" }}
                onClick={() => {
                  setQuery(suggestion.text);
                  router.push(
                    `/search?q=${encodeURIComponent(suggestion.text)}`
                  );
                }}
                className="flex flex-col items-start space-y-3 text-left p-5 bg-card/30 backdrop-blur-md hover:bg-card/80 border border-border/30 hover:border-indigo-500/30 rounded-3xl transition-all group hover:shadow-xl hover:shadow-indigo-500/5"
              >
                <div
                  className={`${suggestion.iconColor} bg-gradient-to-br ${suggestion.color} p-2.5 rounded-2xl flex-shrink-0 transition-transform group-hover:scale-110`}
                >
                  {suggestion.icon}
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors flex-1 line-clamp-2">
                  {suggestion.text}
                </span>
              </motion.button>
            ))}
          </div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs text-muted-foreground/40 text-center uppercase tracking-widest font-medium pt-8"
          >
            Intelligence by Aetheron Core
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
