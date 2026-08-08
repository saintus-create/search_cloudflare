import React, { useState } from "react";
import { CornerDownLeft, Sparkle, Link as LinkIcon, Database, Loader2 } from "lucide-react";
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
    setCrawlMessage("Extracting intelligence...");
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: query }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        setCrawlMessage(`Ingested: ${data.title}`);
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
    <div className={`w-full flex flex-col items-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${mode === 'idle' ? 'mt-0' : '-mt-[20vh]'}`}>
      <form onSubmit={handleSubmit} className="w-full max-w-[44rem] relative mb-20 z-10 group">
        <div className="relative flex items-center w-full border-b-2 border-[#1c1c1c]/20 hover:border-[#1c1c1c] focus-within:!border-[#1c1c1c] transition-all duration-500 py-4">
          <input
            className="flex-1 bg-transparent text-2xl md:text-3xl text-[#1c1c1c] placeholder:text-[#1c1c1c]/30 font-medium tracking-tight outline-none"
            placeholder="Query or ingest..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <button 
            type="submit"
            className="w-12 h-12 flex items-center justify-center text-[#1c1c1c]/40 hover:text-[#1c1c1c] transition-all duration-300"
          >
            <CornerDownLeft className="w-6 h-6 stroke-[2.5]" />
          </button>
        </div>
      </form>

      <AnimatePresence mode="wait">
        {mode === "crawl" && (
          <motion.div 
            key="crawl"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[44rem]"
          >
            <div className="bg-[#f5f5f5] p-8 rounded-none border-l-4 border-[#1c1c1c] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <LinkIcon className="w-6 h-6 text-[#1c1c1c]" />
                <div>
                  <h3 className="font-semibold text-[#1c1c1c] text-lg tracking-tight uppercase">External Domain</h3>
                  <p className="text-[#1c1c1c]/60 text-sm font-medium mt-1">Initiate ingestion protocol?</p>
                </div>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-3 w-full sm:w-auto">
                {status !== "success" && (
                  <button 
                    onClick={handleCrawl}
                    disabled={status === "loading"}
                    className="bg-[#1c1c1c] text-white font-semibold text-xs tracking-widest uppercase px-8 py-4 w-full sm:w-auto hover:bg-black active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:active:scale-100"
                  >
                    {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                    {status === "loading" ? "Ingesting" : "Execute"}
                  </button>
                )}
                {crawlMessage && (
                  <p className={`text-xs font-semibold uppercase tracking-widest ${status === "error" ? "text-red-500" : "text-[#1c1c1c]"}`}>
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
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[44rem] space-y-16 text-left pb-16"
          >
            {/* Minimalist AI Synthesis */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3">
                <Sparkle className="w-4 h-4 text-[#1c1c1c]" />
                <h2 className="text-[0.7rem] font-bold text-[#1c1c1c]/50 uppercase tracking-[0.2em]">Synthesis</h2>
              </div>
              <div className="text-[#1c1c1c] font-medium text-xl leading-relaxed prose prose-slate max-w-none min-h-[60px]">
                {!aiAnswer ? (
                  <div className="flex items-center gap-4 text-[#1c1c1c]/40 italic font-light">
                    <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                  </div>
                ) : (
                  <p dangerouslySetInnerHTML={{ __html: aiAnswer.replace(/\n/g, '<br/>') }} />
                )}
              </div>
            </motion.div>

            {/* Brutalist Sources List */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-8 pt-12 border-t border-[#1c1c1c]/10"
            >
              <div className="flex items-center gap-3 mb-2">
                <Database className="w-4 h-4 text-[#1c1c1c]/40" />
                <h2 className="text-[0.7rem] font-bold text-[#1c1c1c]/40 uppercase tracking-[0.2em]">Citations</h2>
              </div>
              
              <div className="grid gap-0 divide-y divide-[#1c1c1c]/10">
                {status === "loading" && sources.length === 0 ? (
                  <div className="flex items-center gap-4 text-[#1c1c1c]/40 font-light italic py-6">
                    <Loader2 className="w-4 h-4 animate-spin" /> Locating records...
                  </div>
                ) : sources.length > 0 ? (
                  sources.map((src, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: 0.4 + (i * 0.1), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="group block py-8 hover:px-4 hover:bg-[#f5f5f5] transition-all duration-300 -mx-4 px-4 cursor-pointer"
                    >
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[#1c1c1c] font-semibold block mb-3 text-2xl tracking-tight">
                        {src.title}
                      </a>
                      <p className="text-[1.05rem] text-[#1c1c1c]/70 font-light leading-relaxed mb-4">{src.snippet.replace(/<\/?b>/g, '')}</p>
                      <span className="text-[0.65rem] text-[#1c1c1c]/40 flex items-center gap-2 uppercase tracking-[0.15em] font-bold">
                        {src.url}
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-[#1c1c1c]/40 italic font-light py-6">No matching records found.</p>
                )}
              </div>
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
