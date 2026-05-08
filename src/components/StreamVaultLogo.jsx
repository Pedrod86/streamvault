import React from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/69fe35055df988e0955e5c11/471cf7e17_generated_image.png';

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