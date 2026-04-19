"use client";

import Link from "next/link";
import { type ComponentProps, type MouseEvent } from "react";
import { trackContributeClick } from "@/lib/contribute-tracking";

type ContributeCtaLinkProps = ComponentProps<typeof Link> & {
  source: string;
};

export default function ContributeCtaLink({
  source,
  onClick,
  ...props
}: ContributeCtaLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    trackContributeClick(source);
    onClick?.(event);
  };

  return (
    <Link
      {...props}
      onClick={handleClick}
      data-track="contribute-click"
      data-source={source}
    />
  );
}
