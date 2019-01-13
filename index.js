#!/usr/bin/env node

const path = require('path');

const Bundler = require('parcel-bundler');
const ws = require('ws');

const entryFiles = path.join(__dirname, './web/index.html');

module.exports = () => {
  let currentData;

  const opts = {
    port: 1234,
    wsPort: 5051,
  };

  const wss = new ws.Server({
    port: opts.wsPort,
  });

  wss.on('connection', (client) => {
    if (currentData) {
      client.send(currentData);
    }
  });

  const bundler = new Bundler(entryFiles, {});

  const server = bundler.serve();

  return {
    close() {
      wss.close();
      server.then((s) => {
        s.close();
      });
    },
    update(data) {
      wss.clients.forEach((c) => {
        c.send(data);
      });
      currentData = data;
    },
  };
};
