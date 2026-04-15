export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  category: "product" | "stack" | "self-hosting" | "contributing";
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "core-problem",
    question: "What core problem does xreso solve?",
    answer:
      "xreso turns scattered handwritten programming notes into a searchable, trusted, and community-reviewed learning library. Instead of digging through random folders and links, developers get one fast place to learn and share practical knowledge.",
    category: "product",
  },
  {
    id: "why-this-stack",
    question: "Why was this tech stack chosen?",
    answer:
      "We chose Next.js + TypeScript + Drizzle + NextAuth for one reason: shipping speed with long-term reliability. The stack gives us strong type safety, migration clarity, secure auth, and a contributor experience that scales as the project grows.",
    category: "stack",
  },
  {
    id: "self-host-fast",
    question: "How quickly can I self-host or spin this up?",
    answer:
      "Usually in under 10 minutes: clone the repo, run npm install, copy .env.example to .env.local, run npm run db:migrate, and start npm run dev. You will have a fully functional local instance ready for contribution.",
    category: "self-hosting",
  },
  {
    id: "how-to-contribute",
    question: "How do I start contributing without deep context?",
    answer:
      "Open good first issues, pick one scoped task, and submit a focused pull request. Maintainers actively review and help you unblock quickly, so you can ship meaningful contributions from day one.",
    category: "contributing",
  },
];