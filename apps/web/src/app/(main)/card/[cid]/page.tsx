import { notFound } from 'next/navigation';
import { Card, capitalize } from '@kindred-paths/shared';
import { getCardByCid } from '@/core/collection/cards';
import { ManaCost } from '@/components/mana-cost';
import { CardImage } from '@/components/card-image';

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
            <div className="space-y-1.5 rounded-lg bg-navy-50/25 px-4 py-3 border border-navy-50/70">
              {face.rules.map((rule, index) => (
                <p
                  key={index}
                  className={
                    rule.variant === 'keyword' || rule.variant === 'ability'
                      ? 'text-sm leading-relaxed text-ink'
                      : 'text-sm leading-relaxed italic text-muted'
                  }
                >
                  {rule.variant === 'keyword' ? capitalize(rule.content) : rule.content}
                </p>
              ))}
            </div>
          )}

          {(face.pt || face.loyalty !== undefined) && (
            <p className="text-right text-lg font-semibold text-ink">
              {face.pt ? `${face.pt.power}/${face.pt.toughness}` : face.loyalty}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
