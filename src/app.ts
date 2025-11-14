import express from 'express';
import cors from 'cors';
import { router } from './routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', router);

// Sempre por último
app.use(errorHandler);

export default app;
