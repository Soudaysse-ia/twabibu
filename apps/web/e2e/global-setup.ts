import { Socket } from 'node:net';

/** Demo accounts the journeys sign in with: their code-request limit (3 per 15 min) is reset before each run. */
export const DEMO = {
  doctor: 'amina.said@demo.twabibu.km',
  secretary: 'secretariat@demo.twabibu.km',
  pharmacist: 'titulaire.port@demo.twabibu.km',
  admin: 'admin@demo.twabibu.km',
};

const bulk = (s: string) => `$${Buffer.byteLength(s)}\r\n${s}\r\n`;

/** Minimal Redis call (one command, reply ignored), so the tests need no Redis client. Local and CI databases only. */
function redis(url: string, args: string[]): Promise<void> {
  const { hostname, port } = new URL(url);
  const command = `*${args.length}\r\n${args.map(bulk).join('')}`;
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    socket.setTimeout(3000, () => reject(new Error('Redis timeout')));
    socket.once('error', reject);
    socket.connect(Number(port || 6379), hostname || 'localhost', () => socket.write(command));
    socket.once('data', () => {
      socket.end();
      resolve();
    });
  });
}

export default async function globalSetup() {
  const keys = Object.values(DEMO).map((email) => `twabibu:otp-rate:${email}`);
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  await redis(url, ['DEL', ...keys]);
  // Contact form and public-route limits are per network address, and every journey comes from this machine.
  const dropKeys = "for _, k in ipairs(redis.call('KEYS', ARGV[1])) do redis.call('DEL', k) end";
  for (const pattern of ['twabibu:contact-rate:*', 'twabibu:rl:*'])
    await redis(url, ['EVAL', dropKeys, '0', pattern]);
}
