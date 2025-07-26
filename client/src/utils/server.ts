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
