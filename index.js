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

const serve = (port) => {
  const server = http.createServer((request, response) => {
    const { url } = request;
    const resource = url.split('?')[0];

    if (resource === '/') {
      fs.readFile(path.resolve(__dirname, './web/index.html'), (err, data) => {
        response.statusCode = 200;
        response.setHeader('Content-type', 'text/html');
        response.end(data);
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

module.exports = (options = {}) => {
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

    const web = serve(port);

    console.log(`Running dependency flow at: \x1b[32mhttp://localhost:${port}?ws=localhost:${wsPort}\x1b[0m`);

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
      servers.then(({ wss }) => {
        wss.clients.forEach((c) => {
          c.send(data);
        });
      });
      currentData = data;
    },
  };
};
