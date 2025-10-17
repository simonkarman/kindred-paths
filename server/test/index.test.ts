import { AddressInfo } from 'node:net';
import { describe, it } from 'vitest';
import { app } from '../src';

describe('Express Server', () => {
  it('should respond to GET /health with status 200', async () => {
    await new Promise((resolve, reject) => {
      const server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        fetch(`http://localhost:${port}/health`)
          .then((res) => {
            if (res.status === 200) {
              resolve(true);
            } else {
              reject(new Error('Health check failed'));
            }
          })
          .catch(reject)
          .finally(() => server.close());
      });
    });
  });
});
