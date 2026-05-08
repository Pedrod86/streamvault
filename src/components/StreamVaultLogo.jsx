import React from 'react';

const LOGO_URL = 'https://www.dropbox.com/scl/fi/ub9cr2djh0cb7x57m25c7/streamvault.png?rlkey=png0dj93b0c1m3ksls5t5b7wn&st=4nd7duli&dl=1';

export default function StreamVaultLogo({ size = 'md', showName = true }) {
  const sizes = {
    sm: { img: 'w-8 h-8', text: 'text-base' },
    md: { img: 'w-12 h-12', text: 'text-xl' },
    lg: { img: 'w-20 h-20', text: 'text-3xl' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={LOGO_URL}
        alt="StreamVault"
        className={`${s.img} rounded-2xl object-cover shadow-lg shadow-primary/30`}
      />
      {showName && (
        <span className={`font-heading font-bold ${s.text} bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent`}>
          StreamVault
        </span>
      )}
    </div>
  );
}