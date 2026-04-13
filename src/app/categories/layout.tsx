import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Browse programming notes by category — JavaScript, Python, SQL, Java, C#, C++, Rust, Go, Data Structures, Algorithms, DevOps, and more.",
};

export default function CategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
