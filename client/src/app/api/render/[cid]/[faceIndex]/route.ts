import { revalidateTag } from 'next/cache';
import { NextRequest } from 'next/server';
import { internalBackendUrl } from '@/utils/connection';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string, faceIndex: number }> }
) {
  const { cid, faceIndex } = await params;
  const searchParams = request.nextUrl.searchParams;
  const force = searchParams.get('force') === 'true';
  const queryString = searchParams.toString() ? `?${searchParams.toString()}` : '';

  if (force) {
    revalidateTag(`card-${cid}`);
  }

  const path = `/render/${cid}/${faceIndex}${queryString}`;
  const response = await fetch(`${internalBackendUrl}${path}`, {

    // In development, Next.js runs API routes on a single thread and serializes
    // fetches that use cache tags. This causes concurrent image requests to queue
    // up sequentially. We disable caching in dev to allow parallel requests, while
    // keeping cache tags in production for proper revalidation via server actions.
    ...(process.env.NODE_ENV === 'production'
      ? { next: { tags: [`card-${cid}`] } }
      : { cache: 'no-store' }),
  });

  if (!response.ok) {
    return new Response(null, { status: 404 });
  }

  const buffer = await response.arrayBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'image/png',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
