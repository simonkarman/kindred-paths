const defaultBackendUrl = 'http://localhost:4101';

/**
 * The URL of the backend server, used for internal communication.
 * Falls back to localhost if not set.
 *
 * This is used by the Next.js server to communicate with the backend server.
 */
export const internalBackendUrl = process.env.INTERNAL_BACKEND_URL || defaultBackendUrl;

/**
 * The public facing URL of the backend server, used for communication from the client.
 * Falls back to the internal backend url if not set.
 *
 * This is used by the client (browser) to communicate with the backend server.
 */
export const publicFacingBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || defaultBackendUrl;
