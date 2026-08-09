import React, { useState, useRef, useEffect } from "react";
import { Mic, Search as SearchIcon, ChevronDown, Globe, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HeroSearch() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"idle" | "crawl" | "search">("idle");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  
  const [aiAnswer, setAiAnswer] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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
      
      try {
        const res = await fetch("/api/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: query }),
        });
        const data = await res.json();
        if (data.success) {
          setStatus("success");
          setTimeout(() => {
            setQuery("");
            setMode("idle");
            setStatus("idle");
          }, 2000);
        } else {
          setStatus("error");
        }
      } catch (err: any) {
        setStatus("error");
      }
      
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
        .catch(() => {
          setAiAnswer(`Processing error.`);
        });

      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          setSources(data.results || []);
          setStatus("success");
        })
        .catch(() => {
          setStatus("error");
        });
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col relative pt-[25vh]">
      
      {/* Top Search Controls matching reference exactly */}
      <div className="w-full px-8 flex items-end justify-between mb-4 z-20">
        <div className="flex items-center gap-1 font-semibold text-xs tracking-wide cursor-pointer text-black">
          english <ChevronDown className="w-3 h-3 text-black" />
        </div>
        <div className="flex items-center gap-4 text-[#e0e0e0]">
          <Mic className="w-5 h-5 cursor-pointer hover:text-gray-400 transition-colors" />
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="w-5 h-5 cursor-pointer hover:text-gray-400 transition-colors"><rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect><line x1="8" y1="2" x2="8" y2="22"></line><line x1="16" y1="2" x2="16" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line></svg>
        </div>
      </div>

      {/* Main Search Input */}
      <form onSubmit={handleSubmit} className="w-full px-8 relative z-20">
        <div className="relative flex items-center w-full">
          <div className="absolute left-0 w-[3px] h-10 bg-black animate-pulse rounded-full"></div>
          <input
            ref={inputRef}
            className="w-full bg-transparent text-5xl font-bold tracking-tighter text-[#e0e0e0] focus:text-black outline-none pl-5 placeholder:text-[#e0e0e0] transition-colors"
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        <AnimatePresence>
          {mode === 'idle' && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-16 text-[#a3a3a3] text-[0.8rem] font-medium pl-1"
            >
              Type what you are looking for...
            </motion.p>
          )}
        </AnimatePresence>
      </form>

      {/* Bottom Black Results Panel (from reference history box) */}
      <AnimatePresence>
        {mode !== "idle" && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.6 }}
            className="fixed bottom-0 left-0 right-0 md:absolute md:left-auto md:right-auto md:w-[440px] w-full h-[55vh] bg-[#0a0a0a] text-white p-8 overflow-y-auto hide-scrollbar z-50 rounded-t-3xl shadow-2xl"
          >
            {mode === "crawl" && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <Globe className={`w-12 h-12 ${status === 'error' ? 'text-red-500' : 'text-white'} ${status === 'loading' ? 'animate-pulse' : ''}`} />
                <h3 className="text-xl font-bold">Indexing URL</h3>
                <p className="text-gray-400">
                  {status === 'loading' ? 'Extracting content...' : status === 'success' ? 'Indexed successfully' : 'Failed to index'}
                </p>
              </div>
            )}

            {mode === "search" && (
              <div className="space-y-8">
                
                {/* Reference styled header */}
                <div className="w-full flex items-center justify-between border-b border-white/10 pb-4 mb-2">
                  <p className="text-[0.65rem] text-white/50 uppercase tracking-widest font-bold">Synthesis</p>
                  <p className="text-[0.65rem] text-white/50 lowercase tracking-wider">{query}</p>
                </div>

                <div className="space-y-3">
                  <div className="text-base font-medium leading-relaxed text-white">
                    {!aiAnswer ? (
                      <span className="animate-pulse text-white/50">Processing inquiry...</span>
                    ) : (
                      <p dangerouslySetInnerHTML={{ __html: aiAnswer.replace(/\n/g, '<br/>') }} />
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-white/10">
                  <p className="text-[0.65rem] text-white/50 uppercase tracking-widest font-bold mb-4">Citations</p>
                  
                  {status === "loading" && sources.length === 0 ? (
                    <span className="animate-pulse text-white/50 text-sm">Locating...</span>
                  ) : sources.length > 0 ? (
                    sources.map((src, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        transition={{ delay: i * 0.1 }}
                        className="block mb-6 cursor-pointer group"
                      >
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-white font-bold text-sm block mb-1 group-hover:text-white/70 transition-colors">
                          {src.title}
                        </a>
                        <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">{src.snippet.replace(/<\/?b>/g, '')}</p>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-white/50 italic text-sm">No matching records.</p>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
