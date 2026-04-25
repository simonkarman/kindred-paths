import { internalBackendUrl } from '@/utils/connection';

export async function GET() {
  const response = await fetch(`${internalBackendUrl}/strategy`, {
    next: { tags: ['strategy-list'] },
  });
  if (!response.ok) {
    return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
