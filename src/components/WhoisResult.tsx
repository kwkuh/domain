import React from "react";

interface WhoisResultProps {
  data: {
    domainName?: string;
    registrar?: string;
    createdDate?: string;
    expiryDate?: string;
    status?: string;
    nameservers?: string[];
  };
}

const WhoisResult = ({ data }: WhoisResultProps) => {
  return (
    <div className="font-mono text-lg bg-darkBg border border-neonBlue/30 rounded-lg p-6 space-y-3 animate-fadeIn opacity-0 hover:animate-glowPulse">
      <div className="text-neonBlue text-xl mb-4">Domain Information:</div>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="grid grid-cols-[160px,1fr] gap-4">
          <span className="text-white/60">{key}:</span>
          <span className="text-white">
            {Array.isArray(value) ? value.join(", ") : value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default WhoisResult;