// US-1.7: HTTP entry point for the AI ticket pipeline service
import { config } from './config';
import { createApp } from './app';

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`listening on ${config.PORT}`);
});

