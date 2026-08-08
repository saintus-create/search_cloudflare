import React, { useState } from "react";
import { Search, Send, Globe, Sparkles, Database, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "crawl" | "search">("idle");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  
  const [aiAnswer, setAiAnswer] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [crawlMessage, setCrawlMessage] = useState("");

  const isUrl = (text: string) => {
    try {
      const url = new URL(text);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setStatus("loading");

    if (isUrl(query)) {
      setMode("crawl");
    } else {
      setMode("search");
      setAiAnswer("");
      setSources([]);

      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.answer) {
            setAiAnswer(data.answer);
          } else {
            setAiAnswer("No response generated.");
          }
        })
        .catch((err) => {
          setAiAnswer(`Error connecting to AI: ${err.message}`);
        });

      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          setSources(data.results || []);
          setStatus("success");
        })
        .catch((err) => {
          console.error(err);
          setStatus("error");
        });
    }
  };

  const handleCrawl = async () => {
    setStatus("loading");
    setCrawlMessage("Extracting content...");
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: query }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setCrawlMessage(`Indexed securely: ${data.title}`);
        setTimeout(() => {
          setQuery("");
          setMode("idle");
        }, 2500);
      } else {
        throw new Error(data.error);
      }
    } catch (err: any) {
      setStatus("error");
      setCrawlMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div className="w-full flex flex-col items-center">
      <form onSubmit={handleSubmit} className="w-full max-w-2xl relative mb-12 group">
        <div className="relative flex items-center w-full bg-white/90 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04),0_1px_3px_rgb(0,0,0,0.02)] border border-gray-200/80 hover:border-gray-300 focus-within:!border-gray-300 rounded-full h-16 px-4 transition-all duration-300">
          <Search className="text-gray-300 w-5 h-5 ml-2 mr-3 transition-colors duration-300 group-focus-within:gradient-icon" />
          <input
            className="flex-1 bg-transparent text-lg text-gray-900 placeholder:text-gray-400 font-light outline-none"
            placeholder="Ask a question, search documents, or enter a URL..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button 
            type="submit"
            className="w-10 h-10 flex items-center justify-center bg-gray-900 hover:bg-black text-white rounded-full ml-2 transition-all active:scale-95"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {mode === "crawl" && (
          <motion.div 
            key="crawl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl"
          >
            <div className="border border-gray-100/80 shadow-sm bg-gray-50/80 backdrop-blur-sm p-6 rounded-3xl flex flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="p-3.5 bg-white rounded-full shadow-sm border border-gray-100">
                  <Globe className="w-6 h-6 gradient-icon" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-lg tracking-tight">External Link Detected</h3>
                  <p className="text-gray-500 text-sm font-light mt-0.5">Would you like to securely index this page?</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {status !== "success" && (
                  <button 
                    onClick={handleCrawl}
                    disabled={status === "loading"}
                    className="bg-gray-900 text-white font-medium px-6 py-2.5 rounded-full shadow-sm hover:bg-black active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                  >
                    {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                    {status === "loading" ? "Indexing..." : "Index Link"}
                  </button>
                )}
                {crawlMessage && (
                  <p className={`text-xs font-medium ${status === "error" ? "text-red-500" : "text-gray-900"}`}>
                    {crawlMessage}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {mode === "search" && (
          <motion.div 
            key="search"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-3xl space-y-10 text-left pb-16"
          >
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 gradient-icon" />
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">AI Synthesis</h2>
              </div>
              <div className="text-gray-800 font-light text-lg leading-relaxed prose prose-slate max-w-none min-h-[60px]">
                {!aiAnswer ? (
                  <div className="flex items-center gap-3 text-gray-400 italic">
                    <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing...
                  </div>
                ) : (
                  <p dangerouslySetInnerHTML={{ __html: aiAnswer.replace(/\n/g, '<br/>') }} />
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6 pt-10 border-t border-gray-100/60"
            >
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-4 h-4 text-gray-400" />
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">Sourced Documents</h2>
              </div>
              
              <div className="grid gap-8">
                {status === "loading" && sources.length === 0 ? (
                  <div className="flex items-center gap-3 text-gray-400 font-light italic">
                    <Loader2 className="w-4 h-4 animate-spin" /> Retrieving documents...
                  </div>
                ) : sources.length > 0 ? (
                  sources.map((src, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: 0.3 + (i * 0.1), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="group cursor-pointer block"
                    >
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-gray-900 font-medium group-hover:text-gray-600 transition-colors block mb-1.5 text-lg tracking-tight">
                        {src.title}
                      </a>
                      <p className="text-[0.95rem] text-gray-500 font-light leading-relaxed mb-3">{src.snippet.replace(/<\/?b>/g, '')}</p>
                      <span className="text-[0.65rem] text-gray-400 flex items-center gap-1.5 uppercase tracking-widest font-medium">
                        {src.url}
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-gray-400 italic font-light">No matching documents found.</p>
                )}
              </div>
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
