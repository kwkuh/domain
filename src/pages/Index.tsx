import React, { useState } from "react";
import ChatMessage from "@/components/ChatMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import WhoisResult from "@/components/WhoisResult";
import { useToast } from "@/components/ui/use-toast";

const Index = () => {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      content: "Welcome to Mundial.AI! Enter a domain name to lookup its WHOIS information.",
      isBot: true,
    },
  ]);
  const [whoisData, setWhoisData] = useState<any>(null);
  const { toast } = useToast();

  const isValidDomain = (domain: string) => {
    const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    return pattern.test(domain);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidDomain(domain)) {
      toast({
        title: "Invalid domain",
        description: "Please enter a valid domain name (e.g., example.com)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setMessages((prev) => [...prev, { content: domain, isBot: false }]);

    try {
      const response = await fetch(`https://rdap.org/domain/${domain}`);
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

  return (
    <div className="min-h-screen bg-darkBg text-white p-4">
      <div className="max-w-3xl mx-auto">
        <div className="space-y-4 mb-8">
          {messages.map((msg, idx) => (
            <ChatMessage key={idx} {...msg} />
          ))}
          {loading && <LoadingSpinner />}
          {whoisData && <WhoisResult data={whoisData} />}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain name (e.g., example.com)"
            className="flex-1 bg-white/5 border border-neonBlue/30 rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:border-neonBlue"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-neonBlue/10 border border-neonBlue/30 text-neonBlue px-6 py-2 rounded-lg font-mono text-sm hover:bg-neonBlue/20 transition-colors disabled:opacity-50"
          >
            Search
          </button>
        </form>
      </div>
    </div>
  );
};

export default Index;