import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`[api] ouvindo na porta ${config.port}`);
});
