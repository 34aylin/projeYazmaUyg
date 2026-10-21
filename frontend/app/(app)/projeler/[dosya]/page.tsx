import { ProjeEditor } from "./ProjeEditor";

export const instant = false;

interface PageProps {
  params: Promise<{ dosya: string }>;
}

export default async function ProjePage({ params }: PageProps) {
  const { dosya } = await params;
  return <ProjeEditor dosya={dosya} />;
}
