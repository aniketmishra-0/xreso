import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advanced Tracks Library",
  description:
    "Open advanced learning library for Kubernetes, DevOps, and System Design with independent management from standard notes.",
  keywords: [
    "advanced tracks",
    "open learning tracks",
    "kubernetes notes",
    "devops linux ansible",
    "system design learning path",
    "independent track module",
  ],
};

export default function TracksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
