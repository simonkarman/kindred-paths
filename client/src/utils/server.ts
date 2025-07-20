import { z } from 'zod';
import { SerializedCard, SerializedCardSchema } from 'kindred-paths';

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

  if (!response.ok) {
    return null;
  }
  return await response.json();
}
