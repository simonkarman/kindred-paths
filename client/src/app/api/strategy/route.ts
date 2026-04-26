import { internalBackendUrl } from '@/utils/connection';
import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';

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

export async function POST(request: NextRequest) {
  const body = await request.text();
  const response = await fetch(`${internalBackendUrl}/strategy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) {
    const error = await response.text();
    return new Response(error, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  }
  revalidateTag('strategy-list');
  const data = await response.text();
  return new Response(data, {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
