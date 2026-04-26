import { internalBackendUrl } from '@/utils/connection';
import { NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const body = await request.text();
  const response = await fetch(`${internalBackendUrl}/strategy/${filename.toLowerCase()}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) {
    const error = await response.text();
    return new Response(error, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  }
  revalidateTag(`strategies-${filename.toLowerCase()}`);
  const data = await response.text();
  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const response = await fetch(`${internalBackendUrl}/strategy/${filename.toLowerCase()}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.text();
    return new Response(error, { status: response.status, headers: { 'Content-Type': 'application/json' } });
  }
  revalidateTag(`strategies-${filename.toLowerCase()}`);
  revalidateTag('strategy-list');
  return new Response(null, { status: 204 });
}
