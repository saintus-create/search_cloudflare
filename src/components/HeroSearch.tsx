import React, { useState, useRef, useEffect } from "react";
import { Mic, Search as SearchIcon, ChevronDown } from "lucide-react";
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
      
      // Auto-crawl
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
    <div className="w-full h-full flex flex-col relative mt-[25vh]">
      
      {/* Top Search Controls matching reference exactly */}
      <div className="w-full px-8 flex items-end justify-between mb-2">
        <div className="flex items-center gap-1 font-semibold text-sm cursor-pointer">
          english <ChevronDown className="w-4 h-4 text-gray-500" />
        </div>
        <div className="flex items-center gap-4 text-gray-300">
          <Mic className="w-5 h-5 cursor-pointer hover:text-gray-500 transition-colors" />
          <SearchIcon className="w-5 h-5 cursor-pointer hover:text-gray-500 transition-colors" />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full px-8 relative z-10">
        <div className="relative flex items-center w-full">
          <div className="absolute left-0 w-[2px] h-10 bg-black animate-pulse"></div>
          <input
            ref={inputRef}
            className="w-full bg-transparent text-5xl md:text-6xl text-black placeholder:text-[#e0e0e0] font-bold tracking-tight outline-none pl-4"
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
              className="mt-16 text-gray-400 text-sm font-medium pl-4"
            >
              Type what you are looking for...
            </motion.p>
          )}
        </AnimatePresence>
      </form>

      {/* Decorative large circle background (from reference) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30rem] h-[30rem] bg-white rounded-full opacity-60 z-0 pointer-events-none filter blur-2xl"></div>

      {/* Bottom Black Results Panel (from reference history box) */}
      <AnimatePresence>
        {mode !== "idle" && (
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.6 }}
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-xl h-[55vh] bg-black text-white rounded-t-3xl p-8 overflow-y-auto hide-scrollbar z-50 shadow-2xl"
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
                <div className="space-y-3">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">Synthesis</p>
                  <div className="text-lg font-light leading-relaxed text-gray-200">
                    {!aiAnswer ? (
                      <span className="animate-pulse text-gray-500">Processing inquiry...</span>
                    ) : (
                      <p dangerouslySetInnerHTML={{ __html: aiAnswer.replace(/\n/g, '<br/>') }} />
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-gray-800">
                  <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">Citations</p>
                  
                  {status === "loading" && sources.length === 0 ? (
                    <span className="animate-pulse text-gray-500">Locating...</span>
                  ) : sources.length > 0 ? (
                    sources.map((src, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        transition={{ delay: i * 0.1 }}
                        className="block mb-6 cursor-pointer group"
                      >
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-white font-bold text-xl block mb-1 group-hover:text-gray-300 transition-colors">
                          {src.title}
                        </a>
                        <p className="text-sm text-gray-400 line-clamp-2">{src.snippet.replace(/<\/?b>/g, '')}</p>
                      </motion.div>
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No matching records.</p>
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
