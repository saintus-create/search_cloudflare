import React, { useState } from "react";
import { Plus, ArrowUp, Globe, Sparkles, Database, Loader2 } from "lucide-react";
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
    <div className={`w-full flex flex-col items-center transition-all duration-700 ${mode === 'idle' ? 'mt-[15vh]' : 'mt-0'}`}>
      <form onSubmit={handleSubmit} className="w-full max-w-[50rem] relative mb-16 group z-10">
        {/* The Pill Search Bar matching the image exactly */}
        <div className="relative flex items-center w-full bg-[#e3e3e3] rounded-full h-[4.5rem] px-2 transition-all duration-300 shadow-2xl">
          <button type="button" className="w-14 h-14 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors">
            <Plus className="w-7 h-7 stroke-[2]" />
          </button>
          
          <input
            className="flex-1 bg-transparent text-xl text-gray-900 placeholder:text-gray-500 font-medium outline-none mx-2 caret-blue-500"
            placeholder=""
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          
          <button 
            type="submit"
            className="w-14 h-14 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-all active:scale-95"
          >
            <ArrowUp className="w-7 h-7 stroke-[2]" />
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
            <div className="border border-gray-800 shadow-lg bg-[#1e1f20] p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-gray-800 rounded-full shadow-sm border border-gray-700">
                  <Globe className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-100 text-lg tracking-tight">External Link Detected</h3>
                  <p className="text-gray-400 text-sm font-light mt-0.5">Would you like to securely index this page?</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                {status !== "success" && (
                  <button 
                    onClick={handleCrawl}
                    disabled={status === "loading"}
                    className="bg-blue-600 text-white font-medium px-6 py-2.5 rounded-full shadow-sm hover:bg-blue-500 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                  >
                    {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
                    {status === "loading" ? "Indexing..." : "Index Link"}
                  </button>
                )}
                {crawlMessage && (
                  <p className={`text-sm font-medium ${status === "error" ? "text-red-400" : "text-gray-200"}`}>
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
            className="w-full max-w-[50rem] space-y-12 text-left pb-16"
          >
            {/* Dark Mode AI Box */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-4 bg-[#1e1f20] p-8 rounded-[2rem] border border-gray-800 shadow-2xl"
            >
              <div className="flex items-center gap-3 border-b border-gray-800 pb-5 mb-5">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest">AI Synthesis</h2>
              </div>
              <div className="text-gray-300 font-light text-lg leading-relaxed prose prose-invert max-w-none min-h-[60px]">
                {!aiAnswer ? (
                  <div className="flex items-center gap-3 text-gray-500 italic">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> Synthesizing...
                  </div>
                ) : (
                  <p dangerouslySetInnerHTML={{ __html: aiAnswer.replace(/\n/g, '<br/>') }} />
                )}
              </div>
            </motion.div>

            {/* Dark Mode Sources */}
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-6"
            >
              <div className="flex items-center gap-2 mb-4 pl-2">
                <Database className="w-4 h-4 text-gray-500" />
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Sourced Documents</h2>
              </div>
              
              <div className="grid gap-4">
                {status === "loading" && sources.length === 0 ? (
                  <div className="flex items-center gap-3 text-gray-500 font-light italic pl-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> Retrieving documents...
                  </div>
                ) : sources.length > 0 ? (
                  sources.map((src, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, y: 10 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: 0.3 + (i * 0.1), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="group cursor-pointer block bg-[#1e1f20] p-6 rounded-2xl border border-gray-800 hover:border-gray-600 transition-colors shadow-lg"
                    >
                      <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-medium group-hover:text-blue-300 transition-colors block mb-2 text-xl tracking-tight">
                        {src.title}
                      </a>
                      <p className="text-[1rem] text-gray-400 font-light leading-relaxed mb-4">{src.snippet.replace(/<\/?b>/g, '')}</p>
                      <span className="text-[0.7rem] text-gray-500 flex items-center gap-1.5 uppercase tracking-widest font-medium">
                        {src.url}
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-gray-500 italic font-light pl-2">No matching documents found.</p>
                )}
              </div>
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
