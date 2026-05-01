# Aetheron 🌌

Aetheron is an advanced, fully agentic AI search engine built to deliver real-time, highly accurate answers sourced directly from the web. Inspired by platforms like Perplexity, Aetheron acts as an intelligent research assistant, summarizing complex topics by dynamically searching, reading, and synthesizing information across multiple sources.

Built with **Next.js 14**, **Tailwind CSS**, and the **Vercel AI SDK**, Aetheron utilizes ultra-fast inference from **Groq** to power its language models.

---

## 🚀 Features

- **Agentic Web Search:** Aetheron doesn't just guess; it actively searches the internet.
  - Generates highly optimized search queries based on user intent and conversational history.
  - Queries multiple public **SearXNG** instances simultaneously, with an automatic, resilient fallback to DuckDuckGo HTML Lite.
- **Deep Content Extraction:** Uses the **Jina Reader API** to fetch, parse, and clean the actual web content of the discovered URLs, discarding headers, footers, and ads.
- **Retrieval-Augmented Generation (RAG):** Slices, chunks, and keyword-scores the extracted context locally before feeding it to the AI to prevent hallucinations.
- **Real-Time Streaming:** The UI utilizes Server-Sent Events (SSE) via the Vercel AI SDK to stream the Llama models' thinking and generating processes directly to the user in real-time.
- **Conversational Memory:** Preserves history of local chat threads so you can seamlessly revisit previously explored topics.
- **Beautiful UI:** A premium, fully responsive interface powered by Framer Motion animations, Lucide React icons, and a dark/light mode toggle.

---

## 🌟 Why Aetheron Stands Out

There are many AI search engines, but Aetheron differentiates itself through a strict focus on speed, privacy, and efficiency:

1. **🔒 Privacy-First Web Searching:** Aetheron doesn't track you. By combining **SearXNG** (a privacy-respecting metasearch engine) and **DuckDuckGo Lite** for search aggregation, your queries are anonymized and shielded from Big Tech data profiling.
2. **🪶 Ultra-Lightweight "Vector-less" Architecture:** Instead of relying on expensive, heavy Vector Databases like Pinecone, Aetheron performs **local, on-the-fly keyword chunk scoring**. It reads web pages live and scores text against your query in milliseconds, using a fraction of the memory of its competitors.
3. **⚡ Lightning Fast Inference:** Hooked directly into **Groq's LPU inference engine**, Aetheron utilizes incredibly fast open-source models (like `llama-3.1-8b-instant`). This allows tokens to stream into the UI at blistering speeds—no agonizing "thinking" spinners.
4. **🧹 Pure Content Extraction:** Instead of feeding raw HTML to the AI (which causes hallucinations), Aetheron uses the **Jina Reader API**. This strips away cookie banners, complex navigation menus, and ads, leaving only pure, clean Markdown text for the AI to synthesize securely.
5. **💻 100% Local-First Memory:** Your research data never leaves your device unless you query it. Aetheron utilizes **browser-native Local Storage** to maintain your chat history, guaranteeing your past conversations remain totally private and under your control.

---

## 🧠 System Architecture: How It Works

When a user submits a query, Aetheron executes a highly orchestrated pipeline:

1. **Query Rewriting:** A fast model (`llama-3.1-8b-instant`) interprets the user's latest query along with the conversation history. It resolves pronouns/references and generates two new highly optimized search queries.
2. **Execution:** It runs concurrent web searches for the generated queries to aggregate URLs. 
3. **Deduplication:** Aggregated URLs are deduplicated to find the absolute best 6 unique sources.
4. **Scraping (Jina Reader):** The top 3 URLs are fed into the Jina Reader API to get clean text representations of the webpages. 
5. **Local Vector-less Scoring:** The resulting webpage text is split into chunks and scored sequentially against the user's base keywords to weed out irrelevant fluff.
6. **Synthesis:** A highly structured RAG mapping prompt is generated and fed to Aetheron's core model (`meta-llama/llama-4-scout-17b-16e-instruct` by default). The model generates a comprehensive markdown-formatted answer with inline citations `[1]`, streaming back to the client instantly.

---

## 🛠 Setup & Installation

Follow these steps to deploy Aetheron locally for testing or development.

### 1. Requirements

- [Node.js](https://nodejs.org/) 18+  
- A free API key from [Groq](https://console.groq.com/keys)

### 2. Clone the Repository

```bash
git clone https://github.com/Smilin01/Aetheron.git
cd Aetheron
```

### 3. Install Dependencies

You can use npm, yarn, pnpm, or bun. 

```bash
npm install
```

### 4. Configure Environment Variables

Create a new file named `.env.local` in the root of your project:

```bash
touch .env.local
```

Populate it with the following keys:

```env
# Required: Your Groq API Key to power the LLMs
GROQ_API_KEY=gsk_your_api_key_here

# Optional: Override the default synthesis model
# ANSWER_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# Optional: A comma-separated list of your preferred SearXNG instances.
# If not provided, it falls back to a curated list of reliable public nodes.
# SEARXNG_INSTANCES=https://search.sapti.me,https://searx.be

# Optional: Tavily API key to use Tavily as the primary search provider.
# When set, Tavily is used first; SearXNG is the fallback if Tavily returns no results.
# Get your key at https://app.tavily.com (1,000 free credits/month)
# TAVILY_API_KEY=tvly-your_api_key_here
```

### 5. Run the Application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. You can now start searching!

---

## 💻 Tech Stack

- **Framework:** [Next.js 14](https://nextjs.org/) (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Animation:** Framer Motion
- **AI Integration:** [Vercel AI SDK](https://sdk.vercel.ai/docs)
- **Primary LLM Provider:** Groq (Llama 3 / 4)
- **Tooling:** SearXNG (Search), Jina AI (URL content extraction)

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [CONTRIBUTING.md](CONTRIBUTING.md) guide for details on how to get started, format your pull requests, and help build Aetheron.
