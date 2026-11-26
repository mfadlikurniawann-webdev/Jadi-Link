import { notFound } from 'next/navigation';
import { LinkDetail } from '@/features/links/link-detail';
import { LINK_ID_PATTERN } from '@/lib/validation';

export default async function LinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!LINK_ID_PATTERN.test(id)) notFound();
  return <LinkDetail key={id} id={id} />;
}
