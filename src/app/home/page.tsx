import { redirect } from "next/navigation";

type HomePageProps = {
  searchParams?: Promise<{ mode?: string }>;
};

export default async function HomeHubPage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const query = params?.mode ? `?mode=${encodeURIComponent(params.mode)}` : "";
  redirect(`/${query}`);
}
