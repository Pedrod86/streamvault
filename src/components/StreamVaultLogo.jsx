import React from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/69fe35055df988e0955e5c11/6a6f0ca7a_generated_image.png';

export default function StreamVaultLogo({ size = 'md', showName = true }) {
  const sizes = {
    sm: { img: 'w-8 h-8',   text: 'text-base' },
    md: { img: 'w-12 h-12', text: 'text-xl' },
    lg: { img: 'w-24 h-24', text: 'text-4xl' },
    xl: { img: 'w-32 h-32', text: 'text-5xl' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className="flex flex-col items-center gap-2">
      <img
        src={LOGO_URL}
        alt="StreamVault"
        className={`${s.img} rounded-2xl object-cover shadow-2xl shadow-primary/40 ring-1 ring-primary/20`}
      />
      {showName && (
        <span
          className={`font-heading font-extrabold ${s.text} bg-gradient-to-r from-[#ff00e5] via-[#00f0ff] to-[#a64dff] bg-clip-text text-transparent tracking-wide`}
          style={{ filter: 'drop-shadow(0 0 6px rgba(0,240,255,0.8)) drop-shadow(0 0 14px rgba(255,0,229,0.6))' }}
        >
          StreamVault
        </span>
      )}
    </div>
  );
}