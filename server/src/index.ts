import express from 'express';
import cors from 'cors';
import { cardsRouter } from './routes/cards';
import { renderRouter } from './routes/render';
import { suggestionsRouter } from './routes/suggestions';
import { maintenanceRouter } from './routes/maintenance';
import { renderService } from './services/render-service';
import { setsRouter } from './routes/sets';
import { collectionRouter } from './routes/collection';
import { configuration } from './configuration';

export const app = express();
app.use(express.json());
app.use(cors());

// Register routes
app.use('/card', cardsRouter);
app.use('/set', setsRouter);
app.use('/', renderRouter);
app.use('/suggest', suggestionsRouter);
app.use('/', maintenanceRouter);
app.use('/collection', collectionRouter);

// Start server only if not in test mode
if (process.env.NODE_ENV !== 'test') {
  renderService.start().then(() => {
    app.listen(configuration.port, () => {
      console.log(`Server is running on http://localhost:${configuration.port}`);
    });
  }).catch((e: unknown) => {
    console.error('[ERROR] Unable to start render service. Is Card Conjurer running?', e);
    process.exit(1);
  });
}
