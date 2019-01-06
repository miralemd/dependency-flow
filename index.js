#!/usr/bin/env node

const path = require('path');

const Bundler = require('parcel-bundler');
const ws = require('ws');

const entryFiles = path.join(__dirname, './web/index.html');

module.exports = () => {
  let currentTable;

  const opts = {
    port: 1234,
    wsPort: 5051,
  };

  const wss = new ws.Server({
    port: opts.wsPort,
  });

  wss.on('connection', (client) => {
    if (currentTable) {
      client.send(currentTable);
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
    update(table) {
      wss.clients.forEach((c) => {
        c.send(table);
      });
      currentTable = table;
    },
  };
};
