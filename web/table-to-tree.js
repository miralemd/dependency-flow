export default function createTree(table) {
  // const table = [['source', 'target', 'targetSize']];
  const map = new Map();

  const handledPaths = {};

  function group(s) {
    const name = s || '__root__';
    if (handledPaths[name]) {
      return;
    }
    handledPaths[name] = true;
    const i = name.lastIndexOf('/');
    if (i > 0) {
      const parent = name.substring(0, i);
      if (!map.has(parent)) {
        map.set(parent, {
          name: parent,
          children: [],
        });
      }
      const node = map.get(name);
      node.name = name.substring(i + 1);
      map.get(parent).children.push(node);
      group(parent);
    } else if (name !== '__root__') {
      map.get('__root__').children.push(map.get(name));
    }
  }

  map.set('__root__', {
    name: '__root__',
    children: [],
    imports: [],
  });

  table.forEach((relation) => {
    const name = relation[0] || '__root__';
    if (!map.has(name)) {
      map.set(name, {
        name,
        children: [],
        imports: [],
      });
    }
    map.get(name).imports.push(relation[1]);
    const to = relation[1];
    if (!map.has(to)) {
      map.set(relation[1], {
        name: relation[1],
        children: [],
        imports: [],
      });
    }

    map.get(relation[1]).size = relation[2]; // eslint-disable-line

    group(name);
    group(relation[1]);
  });

  return map.get('__root__');
}
