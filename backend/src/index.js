const express = require('express');
const generateRouter = require('./routes/generate.routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use('/generate', generateRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'wison-backend' });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
