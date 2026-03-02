"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, BookOpen, Globe, ArrowRight, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";

export default function Home() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
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
    <main className="flex min-h-screen flex-col items-center justify-center p-6 md:p-24 relative overflow-hidden bg-background">
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 z-20 p-2.5 rounded-full bg-card border border-border/60 hover:bg-accent transition-all shadow-sm hover:shadow-md"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 text-blue-500" />
        )}
      </button>

      {/* Ambient background glow */}
      <div className="absolute top-[20%] left-[30%] w-[500px] h-[500px] rounded-full bg-blue-500/[0.04] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] rounded-full bg-violet-500/[0.04] blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="z-10 w-full max-w-2xl flex flex-col items-center space-y-10"
      >
        {/* Logo */}
        <div className="flex flex-col items-center space-y-3">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-foreground via-foreground to-foreground/40">
            Perplix
          </h1>
          <p className="text-muted-foreground text-center text-base md:text-lg font-medium">
            Where curiosity meets answers. Ask anything.
          </p>
        </div>

        {/* Search Input */}
        <form onSubmit={handleSearch} className="w-full relative group">
          <motion.div
            animate={{
              boxShadow: isFocused
                ? "0 0 0 4px rgba(59, 130, 246, 0.1), 0 20px 60px -15px rgba(0, 0, 0, 0.3)"
                : "0 4px 30px -10px rgba(0, 0, 0, 0.15)",
            }}
            className="relative rounded-full"
          >
            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-blue-400 transition-colors duration-300">
              <Search className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask anything..."
              className="w-full p-4 md:p-5 pl-14 pr-28 text-base md:text-lg bg-card border border-border/60 rounded-full focus:outline-none focus:border-blue-500/40 transition-all placeholder:text-muted-foreground/50"
              autoFocus
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="absolute inset-y-2 right-2 px-5 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold rounded-full hover:from-blue-500 hover:to-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none flex items-center gap-2"
            >
              <span className="hidden sm:inline">Search</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </form>

        {/* Suggestion Cards */}
        <div className="grid grid-cols-1 gap-2.5 w-full">
          {suggestions.map((suggestion, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1, duration: 0.4 }}
              onClick={() => {
                setQuery(suggestion.text);
                router.push(
                  `/search?q=${encodeURIComponent(suggestion.text)}`
                );
              }}
              className="flex items-center space-x-3.5 text-left p-4 bg-card hover:bg-accent/50 border border-border/50 hover:border-border rounded-2xl transition-all group"
            >
              <div
                className={`${suggestion.iconColor} bg-gradient-to-br ${suggestion.color} p-2.5 rounded-xl flex-shrink-0`}
              >
                {suggestion.icon}
              </div>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors flex-1">
                {suggestion.text}
              </span>
              <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-all" />
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground/50 text-center">
          Powered by DuckDuckGo · Jina Reader · Groq
        </p>
      </motion.div>
    </main>
  );
}
