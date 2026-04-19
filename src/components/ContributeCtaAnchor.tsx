"use client";

import { type AnchorHTMLAttributes, type MouseEvent } from "react";
import { trackContributeClick } from "@/lib/contribute-tracking";

type ContributeCtaAnchorProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  source: string;
};

export default function ContributeCtaAnchor({
  source,
  onClick,
  children,
  ...props
}: ContributeCtaAnchorProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    trackContributeClick(source);
    onClick?.(event);
  };

  return (
    <a
      {...props}
      onClick={handleClick}
      data-track="contribute-click"
      data-source={source}
    >
      {children}
    </a>
  );
}
