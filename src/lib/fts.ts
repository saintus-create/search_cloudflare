export const buildFtsQuery = (query: string): string => {
  const stopWords = new Set([
    'what', 'is', 'the', 'a', 'an', 'in', 'on', 'of', 'for', 'to', 'and', 'or', 
    'how', 'why', 'when', 'where', 'who', 'it', 'that', 'this', 'with', 'by', 
    'do', 'does', 'can', 'could', 'would', 'should', 'are', 'were', 'was', 'be', 
    'been', 'being', 'have', 'has', 'had', 'about', 'some', 'tell', 'me', 'explain'
  ]);
  
  const cleanStr = query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
  const words = cleanStr.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));
  
  if (words.length === 0) {
    const fallback = cleanStr.split(/\s+/).filter(w => w.length > 0);
    return fallback.length > 0 ? fallback.map(w => `"${w}"*`).join(' OR ') : '*';
  }
  
  return words.map(w => `"${w}"*`).join(' OR ');
};
