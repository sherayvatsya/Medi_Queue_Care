import React, { useState } from 'react';

interface InitialLoadingScreenProps {
  fadingOut: boolean;
  onLogoReady: () => void;
}

export const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({ fadingOut, onLogoReady }) => {
  const [logoAvailable, setLogoAvailable] = useState(true);

  return (
    <div
      aria-label="Loading Medi Queue"
      role="status"
      className={`initial-loading-screen fixed inset-0 z-[100] overflow-hidden transition-colors duration-700 ease-out ${fadingOut ? 'initial-loading-screen--exit pointer-events-none' : 'bg-[#F5FAF7]'}`}
    >
      {logoAvailable && (
        <img
          src="/mediqueue-logo.png"
          alt=""
          aria-hidden="true"
          onLoad={onLogoReady}
          onError={() => {
            setLogoAvailable(false);
            onLogoReady();
          }}
          className="initial-loading-logo"
        />
      )}
      <div className={`initial-loading-progress h-1.5 w-52 overflow-hidden rounded-full bg-[#D6F1E3] shadow-[0_0_14px_rgba(46,187,134,0.16)] transition-opacity duration-300 ${fadingOut ? 'opacity-0' : 'opacity-100'}`} aria-hidden="true">
        <span className="mediqueue-loading-line block h-full w-1/2 rounded-full bg-gradient-to-r from-[#006B67] via-[#1E9E6C] to-[#2EBB86]" />
      </div>
    </div>
  );
};
