import { SerializedCard } from 'kindred-paths';
import { internalBackendUrl } from '@/utils/connection';

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
