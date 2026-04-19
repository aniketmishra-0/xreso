import { getAdvancedTrackHighlights } from "@/lib/db/queries";
import ClientPage from "./ClientPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Advanced Tracks | xreso",
  description: "Browse the complete collection of advanced system engineering and cloud-native tracks.",
};

export const revalidate = 60; // Cache for 60 seconds

export default async function AdvancedCategoriesPage() {
  const tracks = await getAdvancedTrackHighlights(100, 0, true); // Get all tracks, 0 topics needed for UI
  return <ClientPage tracks={tracks} />;
}
