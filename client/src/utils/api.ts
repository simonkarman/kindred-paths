'use server';

import { z } from 'zod';
import { Collection, SerializableSet, SerializableSetSchema, SerializedCard, SerializedCardSchema, SyncResult } from 'kindred-paths';
import { internalBackendUrl } from './connection';
import { revalidateTag } from 'next/cache';

export async function getCards(): Promise<SerializedCard[]> {
  try {
    const response = await fetch(`${internalBackendUrl}/card`, {
      next: { tags: ['cards'] }
    });
    if (!response.ok) {
      throw new Error('fetch failed with status ' + response.status);
    }
    const responseJson = await response.json();
    return z
      .array(SerializedCardSchema)
      .parse(responseJson)
      // Don't show reference or deleted cards
      .filter(card => card.tags === undefined || card.tags['deleted'] !== true);
  } catch (error: unknown) {
    console.error('Error getting cards:', error);
    return [];
  }
}

export async function getCard(id: string): Promise<SerializedCard | null> {
  try {
    const response = await fetch(`${internalBackendUrl}/card/${id}`, {
      next: { tags: [`card-${id}`] }
    });
    if (!response.ok) {
      throw new Error('fetch failed with status ' + response.status);
    }
    const responseJson = await response.json();
    return SerializedCardSchema.parse(responseJson);
  } catch (error: unknown) {
    console.error('Error getting card:', error);
    return null;
  }
}

export async function deleteCard(id: string): Promise<void> {
  try {
    const response = await fetch(`${internalBackendUrl}/card/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('fetch failed with status ' + response.status);
    }

    revalidateTag('cards');
    revalidateTag(`card-${id}`);
  } catch (error: unknown) {
    console.error('Error deleting card:', error);
    throw error;
  }
}

export async function createCard(serializedCard: SerializedCard): Promise<SerializedCard | null> {
  const response = await fetch(`${internalBackendUrl}/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serializedCard),
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(responseJson, undefined, 2));
  }

  revalidateTag('cards');
  return responseJson;
}

export async function updateCard(serializedCard: SerializedCard): Promise<SerializedCard | null> {
  const response = await fetch(`${internalBackendUrl}/card/${serializedCard.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serializedCard),
  });

  const responseJson = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(responseJson, undefined, 2));
  }

  revalidateTag('cards');
  revalidateTag(`card-${serializedCard.id}`);
  return responseJson;
}

export async function previewCard(serializedCard: SerializedCard, faceIndex: number) {
  const response = await fetch(`${internalBackendUrl}/preview/${faceIndex}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(serializedCard),
  });
  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  return await response.blob();
}

export type CollectorNumberInfo = { collectorNumber: number, cardId: string, faces: { name: string, renderedTypeLine: string }[] };
export async function getOrganizeCollectorNumbers(searchQuery: string): Promise<CollectorNumberInfo[]> {
  const response = await fetch(`${internalBackendUrl}/organize/collector-numbers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: searchQuery }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch next collector numbers');
  }
  return await response.json();
}

export interface NameSuggestion {
  name: string;
  reason: string;
}

export async function getNameSuggestions(card: SerializedCard, faceIndex: number): Promise<NameSuggestion[]> {
  const response = await fetch(`${internalBackendUrl}/suggest/name/${faceIndex}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch name suggestions');
  }
  return await response.json();
}

export interface SettingSuggestion {
  name: string;
  setting: string;
}

export async function getArtSettingSuggestions(card: SerializedCard, faceIndex: number): Promise<SettingSuggestion[]> {
  const response = await fetch(`${internalBackendUrl}/suggest/art-setting/${faceIndex}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch card art suggestions');
  }
  return await response.json();
}

export interface ArtSuggestion {
  fileName: string;
  base64Image: string;
}

export async function getArtSuggestions(card: SerializedCard, faceIndex: number): Promise<ArtSuggestion[]> {
  const response = await fetch(`${internalBackendUrl}/suggest/art/${faceIndex}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch art suggestions');
  }
  return await response.json();
}

export async function getCardSamples(data: { prompt: string } | { generatorId: string }): Promise<{
  generatorId: string,
  samples: SerializedCard[],
}> {
  const response = await fetch(`${internalBackendUrl}/suggest/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch card suggestions');
  }

  const result = await response.json();
  revalidateTag('sample-generators');
  revalidateTag(`sample-generator-${result.generatorId}`);
  return result;
}

export async function getCardSampleGenerators(): Promise<{
  generatorId: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  sampleCount: number;
}[]> {
  const response = await fetch(`${internalBackendUrl}/suggest/card-generator`, {
    next: { tags: ['sample-generators'] }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch card generators');
  }
  return await response.json();
}

export async function getCardSampleGeneratorById(generatorId: string): Promise<{
  generatorId: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  samples: SerializedCard[];
} | null> {
  const response = await fetch(`${internalBackendUrl}/suggest/card-generator/${generatorId}`, {
    next: { tags: [`sample-generator-${generatorId}`] }
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to fetch card generator');
  }
  return await response.json();
}

export type SetSummary = { name: string; matricesCount: number; validCardCount: number; cardCount: number; };
export async function getSets(): Promise<SetSummary[]> {
  const response = await fetch(`${internalBackendUrl}/set`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    next: { tags: ['sets'] },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch sets');
  }
  const data = await response.json();
  return z.array(z.object({
    name: z.string(),
    matricesCount: z.number(),
    validCardCount: z.number(),
    cardCount: z.number(),
  })).parse(data);
}

export async function getSet(name: string): Promise<SerializableSet | null> {
  const response = await fetch(`${internalBackendUrl}/set/${name}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    next: { tags: [`set-${name}`] },
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to fetch set');
  }
  const jsonData = await response.json();
  const parsed = SerializableSetSchema.safeParse(jsonData);
  if (!parsed.success) {
    console.error('Failed to parse set:', parsed.error);
    return null;
  }
  return parsed.data;
}

export async function createSet(name: string): Promise<{ name: string }> {
  const response = await fetch(`${internalBackendUrl}/set`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) {
    throw new Error('Failed to create set');
  }
  const data = await response.json();
  const result = z.object({ name: z.string() }).parse(data);
  revalidateTag(`set-${result.name}`);
  revalidateTag('sets');
  return result;
}

export async function putSet(set: SerializableSet): Promise<void> {
  const response = await fetch(`${internalBackendUrl}/set/${set.name}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(set),
  });
  if (!response.ok) {
    throw new Error('Failed to update set');
  }
  revalidateTag(`set-${set.name}`);
  revalidateTag('sets');
}

export async function getCollection(): Promise<Collection> {
  const response = await fetch(`${internalBackendUrl}/collection`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    next: { tags: ['collection'] },
  });
  if (!response.ok) {
    throw new Error('Failed to fetch collection');
  }
  return await response.json();
}

export async function syncCollection(): Promise<SyncResult> {
  const response = await fetch(`${internalBackendUrl}/collection/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const errorResponse = await response.json();
    throw new Error(response.status + ' Failed to sync collection: ' + errorResponse.error + ' ' + errorResponse.details);
  }
  revalidateTag('collection');
  return await response.json();
}

export async function commitCollection(message: string): Promise<SyncResult> {
  const response = await fetch(`${internalBackendUrl}/collection/commit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    const errorResponse = await response.json();
    throw new Error(response.status + ' Failed to commit collection: ' + errorResponse.error + ' ' + errorResponse.details);
  }
  revalidateTag('collection');
  return await response.json();
}
