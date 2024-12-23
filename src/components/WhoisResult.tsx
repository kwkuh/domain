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
    <div className="font-mono text-sm bg-darkBg border border-neonBlue/30 rounded-lg p-4 space-y-2 animate-fadeIn opacity-0">
      <div className="text-neonBlue">Domain Information:</div>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="grid grid-cols-[120px,1fr] gap-4">
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