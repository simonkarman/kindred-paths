import { Card } from 'kindred-paths';
import { useEffect, useState } from 'react';
import { serverUrl } from '@/utils/server';

export function CardPreview({ card }: { card: Card }) {
  const [imageUrl, setImageUrl] = useState<string>();
  const [cardKeyRelevantForRendering, setCardKeyRelevantForRendering] = useState<string>();
  const [outdated, setOutdated] = useState(false);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    const fetchImage = async () => {
      setIsRendering(true);
      setOutdated(false);
      try {
        const response = await fetch(`${serverUrl}/preview`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(card.toJson()),
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        }
      } catch (error) {
        console.error('Failed to fetch image:', error);
      } finally {
        setIsRendering(false);
      }
    };

    if (cardKeyRelevantForRendering) {
      fetchImage();
    }

    // Cleanup function to revoke the object URL
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [cardKeyRelevantForRendering]); // Re-fetch when card changes

  const currentCardJson = () => {
    return JSON.stringify({ ...card.toJson(), tags: { deck: card.tags.deck, set: card.tags.set } });
  };

  useEffect(() => {
    if (!cardKeyRelevantForRendering || currentCardJson() !== cardKeyRelevantForRendering) {
      setOutdated(true);
    }
  }, [card]);

  return <div>
    <button
      disabled={isRendering}
      onClick={() => setCardKeyRelevantForRendering(currentCardJson())}
      className="block w-full px-3 py-2 mb-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      Preview
    </button>
    {isRendering && <div className="block aspect-[63/88] w-100 bg-purple-50 rounded-3xl border text-center align-middle">Rendering...</div>}
    {imageUrl && !isRendering &&
      <img
        alt={`${card.name} image`}
        className={`block aspect-[63/88] shadow-xl w-100 bg-zinc-50 rounded-2xl border ${outdated ? 'opacity-40' : ''}`}
        src={imageUrl}
      />}
    {imageUrl && outdated && <p className="py-2 text-xl text-center text-red-700 font-bold">Outdated!</p>}
  </div>;
}
