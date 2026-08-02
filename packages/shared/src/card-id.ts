import { z } from 'zod';

export const CardIdSchema = z.string().length(8).regex(/^[a-z0-9]+$/);
export type CardId = z.infer<typeof CardIdSchema>;

export const generateCardId = (): CardId => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('') as CardId;
};

export const getCidFromFilename = (filename: string, extension = 'json'): CardId | null => {
  const regex = new RegExp(`--([a-z0-9]{8})\\.${extension}$`);
  const match = filename.match(regex);
  if (match) {
    return match[1] as CardId;
  }
  return null;
};

export const computeFilename = (slug: string, cid: CardId, extension = 'json'): string => {
  return `${slug}--${cid}.${extension}`;
};
