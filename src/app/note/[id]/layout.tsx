import type { Metadata } from "next";
import { getNoteById } from "@/lib/db/queries";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://xreso.dev";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const note = await getNoteById(id);

  if (!note) {
    return {
      title: "Note Not Found",
      description: "This note could not be found on xreso.",
    };
  }

  return {
    title: note.title,
    description: note.description,
    openGraph: {
      title: `${note.title} | xreso`,
      description: note.description,
      url: `${APP_URL}/note/${note.id}`,
      type: "article",
      images: note.thumbnailUrl
        ? [
            {
              url: note.thumbnailUrl,
              width: 400,
              height: 300,
              alt: note.title,
            },
          ]
        : undefined,
      publishedTime: note.createdAt,
      authors: [note.authorCredit],
      tags: note.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: note.title,
      description: note.description,
      images: note.thumbnailUrl ? [note.thumbnailUrl] : undefined,
    },
  };
}

export default async function NoteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const note = await getNoteById(id);

  // JSON-LD for educational resource
  const jsonLd = note
    ? {
        "@context": "https://schema.org",
        "@type": "LearningResource",
        name: note.title,
        description: note.description,
        url: `${APP_URL}/note/${note.id}`,
        image: note.thumbnailUrl,
        author: {
          "@type": "Person",
          name: note.authorCredit,
        },
        datePublished: note.createdAt,
        educationalLevel: "Beginner to Advanced",
        learningResourceType: "Handwritten Notes",
        about: note.category,
        keywords: note.tags.join(", "),
        interactionStatistic: [
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/ViewAction",
            userInteractionCount: note.viewCount,
          },
          {
            "@type": "InteractionCounter",
            interactionType: "https://schema.org/BookmarkAction",
            userInteractionCount: note.bookmarkCount,
          },
        ],
        license: `https://creativecommons.org/licenses/${note.licenseType
          .replace("CC-", "")
          .toLowerCase()}/`,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {children}
    </>
  );
}
