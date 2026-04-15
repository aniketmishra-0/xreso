import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advanced Tracks Library",
  description:
    "Premium advanced learning module for Kubernetes, DevOps, and System Design with independent management from standard notes.",
  keywords: [
    "advanced tracks",
    "premium learning tracks",
    "kubernetes notes",
    "devops linux ansible",
    "system design learning path",
    "independent track module",
  ],
};

export default function TracksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
