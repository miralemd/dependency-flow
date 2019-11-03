function traverseForwardFrom(id, list, path) {
  const q = list[id] || [];

  for (let i = 0; i < q.length; i++) {
    if (path.indexOf(q[i]) !== -1) {
      continue;
    }
    path.push(q[i]);
    if (list[q[i]]) {
      traverseForwardFrom(q[i], list, path);
    }
  }

  return path;
}

/**
 * @param {Array<from,to>} links
 */
function graph(links) {
  const fromToList = {};
  const toFromList = {};
  links.forEach(([source, target]) => {
    fromToList[source] = fromToList[source] || [];
    fromToList[source].push(target);

    toFromList[target] = toFromList[target] || [];
    toFromList[target].push(source);
  });

  const g = {
    forward(id) {
      const path = [id];
      traverseForwardFrom(id, fromToList, path);
      return path;
    },
    reverse(id) {
      const path = [id];
      traverseForwardFrom(id, toFromList, path);
      return path;
    },
    affected(id) {
      const path = [id];
      traverseForwardFrom(id, fromToList, path);
      traverseForwardFrom(id, toFromList, path);
      return path;
    },
  };

  return g;
}

// module.exports = graph;

export {
  graph as default,
};
