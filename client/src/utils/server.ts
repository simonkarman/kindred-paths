import { z } from 'zod';
import { SerializedCard, SerializedCardSchema } from 'kindred-paths';

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4101';

export async function getCards(): Promise<SerializedCard[]> {
  try {
    const response = await fetch(`${serverUrl}/card`);
    if (!response.ok) {
      throw new Error('fetch failed with status ' + response.status);
    }
    const responseJson = await response.json();
    return z.array(SerializedCardSchema).parse(responseJson);
  } catch (error: unknown) {
    console.error('Error getting cards:', error);
    return [];
  }
}
