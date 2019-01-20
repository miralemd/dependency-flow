#!/usr/bin/env node

const http = require('http');
const path = require('path');
const fs = require('fs');
const ws = require('ws');

const getPort = require('get-port');

const onKill = (cb) => {
  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal, () => {
      cb();
      process.exit();
    });
  });
};

const serve = (port, wsPort) => {
  const server = http.createServer((request, response) => {
    const { url } = request;
    const resource = url.split('?')[0];

    if (resource === '/') {
      fs.readFile(path.resolve(__dirname, './web/index.html'), (err, data) => {
        response.statusCode = 200;
        response.setHeader('Content-type', 'text/html');
        response.end(data.toString()
          .replace('<!--BUNDLE-->', '<script src="./index.js"></script>')
          .replace('<!--WS-->', `<script>window.WSPath = "localhost:${wsPort}";</script>`));
      });
    } else if (resource === '/index.js') {
      fs.readFile(path.resolve(__dirname, './dist/bundle.js'), (err, data) => {
        response.statusCode = 200;
        response.setHeader('Content-type', 'text/javascript');
        response.end(data);
      });
    } else {
      response.statusCode = 404;
      response.end('Nope');
    }
  }).listen(port);

  return server;
};

const getFile = file => new Promise((resolve, reject) => {
  fs.readFile(path.resolve(__dirname, file), (err, data) => {
    if (err) {
      reject(err);
    }
    resolve(data);
  });
});

module.exports = {
  /**
   * @param {object} data
   * @param {object[]} data.links
   * @param {object} data.modules
   * @param {object} options
   * @param {string} options.name="dependency-flow"
   * @param {string} options.dir=${cwd}
   */
  build(data, options = {}) {
    const opts = {
      dir: process.cwd(),
      name: 'dependency-flow',
      ...options,
    };
    Promise.all([
      getFile('./dist/bundle.js'),
      getFile('./web/index.html'),
    ]).then(([bundle, html]) => {
      const s = html.toString().replace('<!--DATA-->', `
  <script>
    window.dependencies = ${JSON.stringify(data)};
  </script>`).replace('<!--BUNDLE-->', `
  <script>
    ${bundle.toString()}
  </script>`);

      const p = path.resolve(opts.dir, `${opts.name}.html`);

      fs.writeFileSync(p, s);
      console.log(`\x1b[32mCreated \x1b[1m${p}\x1b[0m`);
    });
  },
  /**
   * @param {object} options
   * @param {number} options.port
   * @param {number} options.wsPort
   */
  serve(options = {}) {
    let currentData;

    const servers = Promise.all([
      options.port || getPort({ port: [3001, 3002, 3003, 3004, 3005] }),
      getPort({ port: [5051, 5052, 5053, 5054, 5055] }),
    ]).then(([port, wsPort]) => {
      const wss = new ws.Server({
        port: wsPort,
      });

      wss.on('connection', (client) => {
        if (currentData) {
          client.send(currentData);
        }
      });

      const web = serve(port, wsPort);

      console.log(`\x1b[32mServing dependency flow at: \x1b[1mhttp://localhost:${port}\x1b[0m`);

      return {
        wss,
        web,
      };
    });

    const close = () => {
      servers.then(({ wss, web }) => {
        wss.close();
        web.close();
      });
    };

    onKill(close);
    return {
      close,
      update(data) {
        const d = typeof data === 'string' ? data : JSON.stringify(data);
        servers.then(({ wss }) => {
          wss.clients.forEach((c) => {
            c.send(d);
          });
        });
        currentData = d;
      },
    };
  },
};
