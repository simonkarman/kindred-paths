import { z } from 'zod';
import { SerializedCardSummary, SerializedCardSummarySchema } from 'kindred-paths';

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4101';

export async function getCardSummaries(): Promise<SerializedCardSummary[]> {
  try {
    const response = await fetch(`${serverUrl}/card`);
    if (!response.ok) {
      throw new Error('fetch failed with status ' + response.status);
    }
    const responseJson = await response.json();
    return z.array(SerializedCardSummarySchema).parse(responseJson);
  } catch (error: unknown) {
    console.error('Error getting cards:', error);
    return [];
  }
}
