// @ts-check
// Service workers only run in a secure context. The CI suite reaches nginx
// through http://<TEST_HOST>:<PORT> (e.g. http://nginx:8083), which is not
// one, and Chromium's --unsafely-treat-insecure-origin-as-secure flag is not
// honoured by the headless shell. A loopback origin (http://127.0.0.1:<n>)
// is always secure: forward a local port to the stack and browse through it.
const net = require('net');

/**
 * Start a TCP forwarder 127.0.0.1:<random port> -> host:port.
 * @param {string} host
 * @param {number} port
 * `offline()` drops open and new connections (Chromium's setOffline does not
 * apply to loopback addresses), `online()` restores forwarding.
 * @returns {Promise<{ origin: string, offline: () => void, online: () => void, close: () => Promise<void> }>}
 */
function startLoopbackForwarder(host, port) {
  const sockets = new Set();
  let connected = true;
  const server = net.createServer(client => {
    if (!connected) {
      client.destroy();
      return;
    }
    const upstream = net.connect(port, host);
    sockets.add(client);
    sockets.add(upstream);
    client.pipe(upstream);
    upstream.pipe(client);
    const close = () => { client.destroy(); upstream.destroy(); sockets.delete(client); sockets.delete(upstream); };
    client.on('error', close);
    upstream.on('error', close);
    client.on('close', close);
    upstream.on('close', close);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = /** @type {import('net').AddressInfo} */ (server.address());
      resolve({
        origin: `http://127.0.0.1:${address.port}`,
        offline: () => {
          connected = false;
          sockets.forEach(socket => socket.destroy());
        },
        online: () => { connected = true; },
        close: () => new Promise(done => {
          sockets.forEach(socket => socket.destroy());
          server.close(() => done());
        })
      });
    });
  });
}

module.exports = { startLoopbackForwarder };
