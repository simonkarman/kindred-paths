import { z } from 'zod';
import { Card, SerializedCard, SerializedCardSchema } from 'kindred-paths';

export const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4101';

export async function getCards(): Promise<SerializedCard[]> {
  try {
    const response = await fetch(`${serverUrl}/card`);
    if (!response.ok) {
      throw new Error('fetch failed with status ' + response.status);
    }
    const responseJson = await response.json();
    return z
      .array(SerializedCardSchema)
      .parse(responseJson)
      // Don't show reference or deleted cards
      .filter(card => card.tags === undefined || (
        card.tags['reference'] === undefined &&
        card.tags['deleted'] !== true
      ));
  } catch (error: unknown) {
    console.error('Error getting cards:', error);
    return [];
  }
}

export async function getCard(id: string): Promise<SerializedCard | null> {
  try {
    const response = await fetch(`${serverUrl}/card/${id}`);
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
    const response = await fetch(`${serverUrl}/card/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('fetch failed with status ' + response.status);
    }
  } catch (error: unknown) {
    console.error('Error deleting card:', error);
    throw error;
  }
}

export async function createCard(serializedCard: SerializedCard): Promise<SerializedCard | null> {
  const response = await fetch(`${serverUrl}/card`, {
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
  return responseJson;
}

export async function updateCard(serializedCard: SerializedCard): Promise<SerializedCard | null> {
  const response = await fetch(`${serverUrl}/card/${serializedCard.id}`, {
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
  return responseJson;
}

export async function previewCard(serializedCard: SerializedCard) {
  const response = await fetch(`${serverUrl}/preview`, {
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

export interface NameSuggestion {
  name: string;
  reason: string;
}

export async function getNameSuggestions(card: Card): Promise<NameSuggestion[]> {
  const cardJson = card.toJson();
  const response = await fetch(`${serverUrl}/suggest/name`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cardJson),
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

export async function getArtSettingSuggestions(card: Card): Promise<SettingSuggestion[]> {
  const cardJson = card.toJson();
  const response = await fetch(`${serverUrl}/suggest/art-setting`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cardJson),
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

export async function getArtSuggestions(card: Card): Promise<ArtSuggestion[]> {
  const cardJson = card.toJson();
  const response = await fetch(`${serverUrl}/suggest/art`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cardJson),
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
  const response = await fetch(`${serverUrl}/suggest/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch card suggestions');
  }
  return await response.json();
}

export async function getCardSampleGenerators(): Promise<{
  generatorId: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  sampleCount: number;
}[]> {
  const response = await fetch(`${serverUrl}/suggest/card-generator`);
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
  const response = await fetch(`${serverUrl}/suggest/card-generator/${generatorId}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error('Failed to fetch card generator');
  }
  return await response.json();
}
