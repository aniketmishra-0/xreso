import { Suspense } from "react";
import SearchClient from "./SearchClient";

export const revalidate = 0;

export default function UniversalSearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchClient />
    </Suspense>
  );
}
