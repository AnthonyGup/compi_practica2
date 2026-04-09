const express = require('express');
const cors = require('cors');
const generateRouter = require('./routes/generate.routes');
const tokenizeRouter = require('./routes/tokenize.routes');
const analyzeRouter = require('./routes/analyze.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:4200', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use('/generate', generateRouter);
app.use('/tokenize', tokenizeRouter);
app.use('/analyze', analyzeRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'wison-backend' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
