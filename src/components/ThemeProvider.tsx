"use client";

import { ThemeProvider } from "next-themes";
import { ReactNode } from "react";

export default function ThemeProviderWrapper({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={["dark", "light"]}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
