import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, capitalize } from '@kindred-paths/shared';
import { getCardByCid } from '@/core/collection/cards';
import { ManaCost } from '@/components/mana-cost';
import { CardImage } from '@/components/card-image';
import { RulesText } from '@/components/rules-text';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cid: string }>;
}): Promise<Metadata> {
  const { cid } = await params;
  const serializedCard = await getCardByCid(cid);
  if (!serializedCard) return {};

  const card = new Card(serializedCard);
  const title = card.faces.map((face) => face.name).join(' // ');
  return { title };
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ cid: string }>;
}) {
  const { cid } = await params;
  const serializedCard = await getCardByCid(cid);
  if (!serializedCard) notFound();

  const card = new Card(serializedCard);
  const face = card.faces[0];
  const manaCost = face.renderManaCost();
  const set = card.getTagAsString('set');

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex flex-col items-center gap-8 md:flex-row md:items-start">
        {/* Left: card image */}
        <div className="w-full max-w-md shrink-0 md:w-95 lg:w-105">
          <CardImage cid={card.cid} name={face.name} />
        </div>

        {/* Right: rules panel */}
        <div className="w-full space-y-4 rounded-lg border border-line bg-surface p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-semibold text-ink">{face.name}</h1>
            {manaCost && <ManaCost cost={manaCost} />}
          </div>
          <p className="-mt-3 text-sm text-muted">{face.renderTypeLine()}</p>

          {face.rules.length > 0 && (
            <div className="space-y-3">
              {face.rules.map((rule, index) => (
                <p
                  key={index}
                  className={
                    rule.variant === 'keyword' || rule.variant === 'ability'
                      ? 'text-sm leading-relaxed text-ink'
                      : 'text-sm leading-relaxed italic text-muted'
                  }
                >
                  <RulesText content={rule.variant === 'keyword' ? capitalize(rule.content) : rule.content} />
                </p>
              ))}
            </div>
          )}

          {(face.pt || face.loyalty !== undefined) && (
            <p className="text-right text-lg font-semibold text-ink">
              {face.pt ? `${face.pt.power}/${face.pt.toughness}` : face.loyalty}
            </p>
          )}

          {set && (
            <div className="pt-2">
              <Link
                href={`/search?q=${encodeURIComponent(`set:${set}`)}`}
                className="uppercase inline-block rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-navy-50/50 hover:text-ink"
              >
                {set}
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
