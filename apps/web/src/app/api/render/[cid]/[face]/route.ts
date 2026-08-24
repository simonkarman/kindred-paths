// GET /api/render/:cid/:face?variant=png|thumb&force=true — canonical image for a card face.
//
// This is the only HTTP boundary for rendering (docs/v2-architecture.md §5/§10): it
// translates the request into a call against src/core/, which does the actual work (card
// lookup + the cached, concurrency-bounded Renderer). 404s if the card or face doesn't
// exist; 400 on a malformed face index or variant.
//
// `variant=thumb` (used by the overview grid) serves the small 488×684 WebP thumbnail
// withCache generates alongside every full render — much cheaper to ship to a grid of
// hundreds of cards than the full 2010×2814 PNG (the default `variant=png`).

import { NextRequest, NextResponse } from 'next/server';
import { renderCardFace, type RenderVariant } from '@/core/render/render-card-face';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cid: string; face: string }> },
) {
  const { cid, face } = await params;

  const faceIndex = Number(face);
  if (!Number.isInteger(faceIndex) || faceIndex < 0) {
    return NextResponse.json({ error: `invalid face index "${face}"` }, { status: 400 });
  }

  const url = new URL(request.url);
  const variantParam = url.searchParams.get('variant') ?? 'png';
  if (variantParam !== 'png' && variantParam !== 'thumb') {
    return NextResponse.json({ error: `invalid variant "${variantParam}" (expected "png" or "thumb")` }, { status: 400 });
  }
  const variant = variantParam as RenderVariant;
  const skipCache = url.searchParams.get('force') === 'true';

  const result = await renderCardFace(cid, faceIndex, { variant, skipCache });

  if (result.status === 'card-not-found') {
    return NextResponse.json({ error: `card "${cid}" not found` }, { status: 404 });
  }
  if (result.status === 'face-not-found') {
    return NextResponse.json({ error: `card "${cid}" has no face at index ${faceIndex}` }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    status: 200,
    headers: {
      'Content-Type': result.contentType,
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
}
