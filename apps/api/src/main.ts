import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await createApp(config);
await app.listen(config.API_PORT);
const docs = config.APP_ENV === 'production' ? '' : ' (docs: /v1/docs)';
new Logger('Bootstrap').log(`Twabibu API on http://localhost:${config.API_PORT}${docs}`);
