import { internalBackendUrl } from '@/utils/connection';
import { NextRequest } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const response = await fetch(`${internalBackendUrl}/strategy/${filename.toLowerCase()}`, {
    next: { tags: [`strategies-${filename.toLowerCase()}`] },
  });
  if (!response.ok) {
    return new Response(null, { status: response.status });
  }
  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
