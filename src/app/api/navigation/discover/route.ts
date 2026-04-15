import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    section: "discover",
    items: [
      {
        id: "discover-all-notes",
        label: "All Notes",
        description: "Browse the complete public library",
        href: "/browse",
      },
      {
        id: "discover-categories",
        label: "Categories",
        description: "Filter by language and core CS areas",
        href: "/categories",
      },
      {
        id: "discover-featured",
        label: "Featured Notes",
        description: "Curated high-signal notes",
        href: "/browse?featured=true",
      },
    ],
  });
}
