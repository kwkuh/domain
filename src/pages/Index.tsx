import React, { useState } from "react";
import ChatMessage from "@/components/ChatMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import WhoisResult from "@/components/WhoisResult";
import { useToast } from "@/components/ui/use-toast";

const popularDomains = [
  "google.com",
  "facebook.com",
  "twitter.com",
  "microsoft.com",
  "apple.com",
];

const Index = () => {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      content: "Welcome to Mundial.AI! Enter a domain name to lookup its WHOIS information. I can help you find details about any domain's registration, ownership, and DNS settings.",
      isBot: true,
    },
  ]);
  const [whoisData, setWhoisData] = useState<any>(null);
  const { toast } = useToast();

  const isValidDomain = (domain: string) => {
    const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return pattern.test(domain);
  };

  const handleSearch = async (searchDomain: string) => {
    if (!isValidDomain(searchDomain)) {
      toast({
        title: "Invalid domain",
        description: "Please enter a valid domain name (e.g., example.com)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setMessages((prev) => [...prev, { content: searchDomain, isBot: false }]);

    try {
      const response = await fetch(`https://rdap.org/domain/${searchDomain}`);
      const data = await response.json();

      const formattedData = {
        domainName: data.ldhName,
        registrar: data.entities?.[0]?.vcardArray?.[1]?.[1]?.[3] || "N/A",
        createdDate: data.events?.find((e: any) => e.eventAction === "registration")?.eventDate || "N/A",
        expiryDate: data.events?.find((e: any) => e.eventAction === "expiration")?.eventDate || "N/A",
        status: Array.isArray(data.status) ? data.status.join(", ") : "N/A",
        nameservers: data.nameservers?.map((ns: any) => ns.ldhName) || [],
      };

      setWhoisData(formattedData);
      setMessages((prev) => [
        ...prev,
        { content: "Here's what I found:", isBot: true },
      ]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch WHOIS data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(domain);
  };

  return (
    <div className="flex flex-col min-h-screen bg-darkBg text-white">
      <div className="flex-grow p-4">
        <div className="max-w-4xl mx-auto">
          <div className="space-y-4 mb-8">
            {messages.map((msg, idx) => (
              <ChatMessage 
                key={idx} 
                {...msg} 
                className={`text-xl ${
                  idx % 4 === 0 ? 'text-[#ea384c]' :  // Red
                  idx % 4 === 1 ? 'text-[#F97316]' :  // Orange
                  idx % 4 === 2 ? 'text-[#FEF7CD]' :  // Yellow
                  'text-[#1EAEDB]'                     // Blue
                }`}
              />
            ))}
            {loading && <LoadingSpinner />}
            {whoisData && <WhoisResult data={whoisData} />}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-mono text-neonBlue mb-4 animate-float">Popular Domains</h2>
            <div className="flex flex-wrap gap-3">
              {popularDomains.map((d) => (
                <button
                  key={d}
                  onClick={() => handleSearch(d)}
                  className="bg-neonBlue/10 border border-neonBlue/30 text-neonBlue px-4 py-2 rounded-lg font-mono text-lg hover:animate-glowPulse transition-all"
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Enter domain name (e.g., example.com)"
              className="flex-1 bg-white/5 border border-neonBlue/30 rounded-lg px-4 py-2 font-mono text-xl focus:outline-none focus:border-neonBlue focus:animate-glowPulse"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-neonBlue/10 border border-neonBlue/30 text-neonBlue px-6 py-2 rounded-lg font-mono text-xl hover:animate-glowPulse transition-all disabled:opacity-50"
            >
              Search
            </button>
          </form>
        </div>
      </div>
      
      <footer className="text-center py-4 border-t border-neonBlue/30">
        <p className="text-sm text-white/60">
          Made with Love ❤️ in <a href="https://lovable.app" target="_blank" rel="noopener noreferrer" className="text-neonBlue hover:underline">lovable.app</a>
        </p>
      </footer>
    </div>
  );
};

export default Index;