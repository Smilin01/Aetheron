"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  BookOpen,
  Globe,
  ArrowRight,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Github,
  ChevronDown,
  Layers,
  Zap,
  Microscope,
  FlaskConical,
  Check,
  Cpu,
  Hexagon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/components/ThemeProvider";
import Image from "next/image";

import {
  type ChatThread,
  Sidebar,
  loadThreads,
  deleteThread,
} from "@/components/Sidebar";

// ─── Search Modes ───────────────────────────────────────────
const SEARCH_MODES = [
  {
    id: "search",
    label: "Search",
    icon: Zap,
    description: "Quick answers from the web",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  {
    id: "research",
    label: "Research",
    icon: Microscope,
    description: "In-depth analysis with more sources",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
  },
  {
    id: "deep_research",
    label: "Deep Research",
    icon: FlaskConical,
    description: "Comprehensive multi-step research",
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

// ─── Available Models ───────────────────────────────────────
const MODELS = [
  { id: "meta-llama/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout", badge: "", icon: <MetaLogo className="w-3.5 h-3.5" /> },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "Pro", icon: <MetaLogo className="w-3.5 h-3.5" /> },
  { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2", badge: "Smart", icon: <MoonshotLogo className="w-3.5 h-3.5" /> },
  { id: "qwen/qwen3-32b", label: "Qwen 3 32B", badge: "", icon: <AlibabaLogo className="w-3.5 h-3.5" /> },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [selectedMode, setSelectedMode] = useState(SEARCH_MODES[0].id);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [showModePicker, setShowModePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);

  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const modePickerRef = useRef<HTMLDivElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThreads(loadThreads());
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (modePickerRef.current && !modePickerRef.current.contains(e.target as Node)) {
        setShowModePicker(false);
      }
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(
        `/search?q=${encodeURIComponent(query.trim())}&mode=${selectedMode}&model=${encodeURIComponent(selectedModel)}`
      );
    }
  };

  const handleSelectThread = (thread: ChatThread) => {
    router.push(`/search?thread=${thread.id}`);
  };

  const handleDeleteThread = (id: string) => {
    deleteThread(id);
    setThreads(loadThreads());
  };

  const currentMode = SEARCH_MODES.find((m) => m.id === selectedMode) || SEARCH_MODES[0];
  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];
  const ModeIcon = currentMode.icon;

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

        {/* Header Actions */}
        <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
          <a
            href="https://github.com/Smilin01/Aetheron"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-full bg-card/40 backdrop-blur-md border border-border/40 hover:bg-accent transition-all shadow-sm hover:shadow-md text-muted-foreground hover:text-foreground"
            aria-label="GitHub Repository"
          >
            <Github className="w-5 h-5" />
          </a>
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-card/40 backdrop-blur-md border border-border/40 hover:bg-accent transition-all shadow-sm hover:shadow-md text-muted-foreground hover:text-foreground"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-zinc-900" />
            )}
          </button>
        </div>

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

          {/* Search Input — Perplexity-style with modes & model */}
          <form onSubmit={handleSearch} className="w-full relative group z-50">
            <motion.div
              animate={{
                boxShadow: isFocused
                  ? "0 0 0 1px rgba(99, 102, 241, 0.2), 0 20px 60px -15px rgba(0, 0, 0, 0.4)"
                  : "0 4px 30px -10px rgba(0, 0, 0, 0.15)",
                scale: isFocused ? 1.01 : 1,
              }}
              transition={{ duration: 0.2 }}
              className="relative rounded-2xl bg-card/60 backdrop-blur-xl border border-border/40"
            >
              {/* Text Input Area */}
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Ask anything..."
                  className="w-full px-6 pt-5 pb-14 text-base md:text-lg bg-transparent focus:outline-none transition-all placeholder:text-muted-foreground/40"
                  autoFocus
                />
              </div>

              {/* Bottom Toolbar — Mode + Model + Submit */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-2">
                  {/* Search Mode Selector */}
                  <div className="relative" ref={modePickerRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModePicker(!showModePicker);
                        setShowModelPicker(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                    >
                      <ModeIcon className="w-4 h-4" />
                      <span>{currentMode.label}</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>

                    <AnimatePresence>
                      {showModePicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 top-full mt-2 w-72 bg-popover text-popover-foreground border border-border shadow-2xl rounded-2xl p-2 z-50 overflow-hidden"
                        >
                          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                            Focus
                          </div>
                          {SEARCH_MODES.map((mode) => {
                            const Icon = mode.icon;
                            return (
                              <button
                                key={mode.id}
                                type="button"
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

                  {/* Model Selector */}
                  <div className="relative" ref={modelPickerRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModelPicker(!showModelPicker);
                        setShowModePicker(false);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                    >
                      <Layers className="w-4 h-4" />
                      <span className="hidden sm:inline">{currentModel.label}</span>
                      <span className="sm:hidden">{currentModel.label}</span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </button>

                    <AnimatePresence>
                      {showModelPicker && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -8, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          className="absolute left-0 top-full mt-2 w-72 bg-popover text-popover-foreground border border-border shadow-2xl rounded-2xl p-2 z-50 overflow-hidden"
                        >
                          <div className="px-2 pb-2 mb-2 border-b border-border/50">
                            <div className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-medium text-sm hover:bg-teal-500/20 transition-colors cursor-pointer">
                              <span>Upgrade for best models</span>
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </div>
                          {MODELS.map((model) => (
                            <button
                              key={model.id}
                              type="button"
                              onClick={() => {
                                setSelectedModel(model.id);
                                setShowModelPicker(false);
                              }}
                              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors ${selectedModel === model.id
                                ? "bg-accent"
                                : "hover:bg-accent/50"
                                }`}
                            >
                              <div className="flex items-center justify-center shrink-0 w-6 h-6 border border-border/50 rounded bg-background/50 shadow-sm text-foreground/80">
                                {model.icon}
                              </div>
                              <div className="flex flex-col flex-1 pl-1">
                                <span className="text-sm font-medium">{model.label}</span>
                              </div>
                              {model.badge && (
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-2">
                                  {model.badge}
                                </span>
                              )}
                              {selectedModel === model.id && (
                                <Check className="w-4 h-4 text-foreground ml-2" />
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="px-5 py-1.5 bg-foreground text-background font-semibold rounded-full hover:bg-foreground/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all shadow-lg shadow-foreground/10 disabled:shadow-none flex items-center gap-2 text-sm"
                >
                  <span className="hidden sm:inline">Search</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
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
                    `/search?q=${encodeURIComponent(suggestion.text)}&mode=${selectedMode}&model=${encodeURIComponent(selectedModel)}`
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
