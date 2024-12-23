import React from "react";

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="relative w-10 h-10">
        <div className="absolute border-4 border-neonBlue/30 rounded-full w-full h-full animate-spin border-t-neonBlue" />
      </div>
    </div>
  );
};

export default LoadingSpinner;