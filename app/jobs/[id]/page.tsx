import { JobView } from "@/components/JobView";

export const metadata = { title: "Your Shorts · ClipAndPost AI" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <JobView id={id} />;
}
