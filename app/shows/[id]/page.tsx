import { ShowDetailView } from "@/components/ytx/ShowDetailView";

export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShowDetailView showId={id} />;
}
