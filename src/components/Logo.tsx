import type { FC } from "react";

interface LogoProps {
  className?: string;
}

const Logo: FC<LogoProps> = ({ className }) => {
  return (
    <svg 
      width="28" 
      height="28" 
      viewBox="0 0 32 32" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      <defs>
        <linearGradient id="logoXGrad1" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--primary-light)" />
          <stop offset="1" stopColor="var(--primary-dark)" />
        </linearGradient>
        <linearGradient id="logoXGrad2" x1="28" y1="4" x2="4" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-orange-light)" />
          <stop offset="1" stopColor="var(--accent-orange-dark)" />
        </linearGradient>
      </defs>
      <path 
        d="M26 6L6 26" 
        stroke="url(#logoXGrad1)" 
        strokeWidth="6" 
        strokeLinecap="round" 
      />
      <path 
        d="M6 6L26 26" 
        stroke="url(#logoXGrad2)" 
        strokeWidth="6" 
        strokeLinecap="round" 
      />
    </svg>
  );
};

export default Logo;
