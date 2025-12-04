const defaultBackendUrl = 'http://localhost:4101';

/**
 * The URL of the backend server, used for internal communication.
 * Falls back to localhost if not set.
 *
 * This is used by the Next.js server to communicate with the backend server.
 */
export const internalBackendUrl = process.env.INTERNAL_BACKEND_URL || defaultBackendUrl;
