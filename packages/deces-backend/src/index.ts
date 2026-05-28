import { app } from './server';
import { logRedisTarget } from './redis';

const port = 8080;

app.listen( port, () => {
  // eslint-disable-next-line no-console
  console.log( `server started at http://localhost:${ port }` );
  // Surface which Redis the backend actually connects to (single resolved
  // target shared by OTP and BullMQ) for deploy-time visibility.
  logRedisTarget();
} );
