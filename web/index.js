import * as d3 from 'd3';
import graphFn from './graph';

function createTree(leaves) {
  const map = new Map();

  map.set('__root__', {
    id: '__root__',
    children: [],
  });

  Object.keys(leaves).forEach((leaf) => {
    const parts = leaf.split('/');
    let path = '';
    parts.forEach((p, i) => {
      const parent = map.get(path || '__root__');
      path = parts.slice(0, i + 1).join('/');
      if (!path && leaf[0] === '/') {
        path = '/';
      }
      if (!map.has(path)) {
        map.set(path, {
          ...(path === leaf ? leaves[leaf] : {}),
          id: path,
          name: p,
          children: [],
        });
        parent.children.push(map.get(path));
      }
    });
  });

  return map;
}

// collapse folders containing only one child to avoid deep nesting
function collapse() {
  function next(node) {
    if (node.children.length === 1) {
      return next(node.children[0]);
    }
    return [node];
  }

  function children(d) {
    if (d.children.length === 1) {
      return next(d.children[0]);
    }
    if (d.children.length > 1) {
      const arr = [];
      d.children.forEach(n => arr.push(...next(n)));
      return arr;
    }
    return d.children;
  }

  return children;
}

function flow() {
  const links = [];
  const rect = document.body.getBoundingClientRect();

  let state = {
    animate: true,
    collapse: true,
    padding: 2,
    tension: 0.9,
    links: [],
    modules: {},
  };

  const svg = d3.select('svg');
  svg.append('g').attr('class', 'circles');
  svg.append('g').attr('class', 'links').attr('pointer-events', 'none');
  svg.append('g')
    .attr('class', 'labels')
    .attr('pointer-events', 'none');
  svg.attr('width', rect.width);
  svg.attr('height', rect.height - 4);
  svg.attr('viewBox', `-${rect.width / 2} -${rect.height / 2} ${rect.width} ${rect.height}`);

  svg.on('click', () => onNodeClick(null));

  const size = Math.min(rect.width, rect.height) * 0.9;

  const pack = d3.pack()
    .size([size, size]);

  const zoomer = d3.zoom().on('zoom', () => {
    zoomTo(d3.event.transform);
  });

  svg.call(zoomer);

  let root;
  let linkFocus;
  let lineFn;

  let map;

  let node;
  let paths;
  let label;

  return {
    setState(s) {
      state = {
        ...state,
        ...s,
      };

      state.tree = createTree(state.modules);
      state.hierarchy = d3.hierarchy(state.tree.get('__root__'), state.collapse ? collapse(state.tree) : undefined);

      state.graph = graphFn(state.links);

      pack.padding(state.padding);
      this.update();
    },
    getState() {
      return state;
    },
    update() {
      let uid = 0;
      links.length = 0;

      svg.select('.links').classed('animate', state.animate);

      const h = state.hierarchy;

      h.eachBefore((n) => {
        const p = n.parent ? n.parent.data.id : '';
        n.data.url = `uid-${++uid}`;
        n.data.displayName = n.data.displayName || n.data.name;
        if (state.collapse) {
          const sub = n.data.id.indexOf(p) === 0 ? n.data.id.replace(p, '') : n.data.name;
          n.data.displayName = sub;
        } else if (n.children && n.children.length === 1) {
          n.children[0].data.displayName = p ? `${n.data.displayName}/${n.children[0].data.name}` : n.children[0].data.name;
          n.data.displayName = '';
        }
      });
      map = new Map(h.descendants().map(d => [d.data.id, d]));

      h.sum(d => d.size || 0)
        .sort((a, b) => b.value - a.value);

      root = pack(h);
      let maxDistance = 0;

      state.links.forEach((l) => {
        const source = map.get(l[0]);
        const target = map.get(l[1]);
        if (!source) {
          console.warn('missing link source node: ', l[0]);
          return;
        }
        if (!target) {
          console.warn('missing link target node: ', l[1]);
          return;
        }
        const chain = source.path(target);
        maxDistance = Math.max(chain.length, maxDistance);
        const start = {
          data: chain[0].data,
          x: chain[0].x,
          y: chain[0].y,
        };
        links.push({
          source,
          target,
          chain: [start, ...chain.slice(1)],
        });
      });

      const cellColor = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, root.height * 2]);

      node = svg.select('.circles')
        .selectAll('circle')
        .data(root.descendants().slice(1), d => d.data.id);

      node.exit().remove();

      node = node
        .enter()
        .append('circle')
        .on('click', onNodeClick)
        .merge(node)
        .attr('id', d => `${d.data.url}`)
        .attr('class', d => `${d.children ? 'branch' : 'leaf'}`)
        .style('fill', d => cellColor(d.height));

      paths = svg.select('.links')
        .selectAll('path')
        .data(links, d => `${d.source.data.id} - ${d.target.data.id}`);

      paths.exit().remove();

      paths = paths
        .enter()
        .append('path')
        .merge(paths);

      label = svg.select('.labels')
        .selectAll('text')
        .data(root.descendants().slice(1), d => d.data.id);
      label.exit().remove();
      label = label
        .enter()
        .append('text')
        .merge(label)
        .text(d => d.data.displayName);

      svg.call(zoomer.transform, d3.zoomIdentity);
    },
  };

  function zoomTo(t) {
    if (!root) {
      return;
    }
    const { k } = t;
    const dx = root.x - t.x / k;
    const dy = root.y - t.y / k;

    node.attr('transform', d => `translate(${(d.x - dx) * k},${(d.y - dy) * k})`);
    node.attr('r', d => d.r * t.k);

    lineFn = d3.line()
      .curve(d3.curveBundle.beta(state.tension))
      .y(d => (d.y - dy) * k)
      .x(d => (d.x - dx) * k);

    paths.attr('d', d => lineFn(d.chain));

    label
      .attr('transform', d => `translate(${(d.x - dx) * k},${(d.y - dy) * k - d.r * t.k * 0.8})`)
      .style('font-size', d => d.r * t.k * 0.1)
      .style('display', d => (d.r * t.k > size * 0.1 ? 'inline' : 'none'));
  }

  function filterLinks() {
    const affectedSet = new Set();
    if (linkFocus && linkFocus.children && linkFocus.children.length) {
      const files = linkFocus.leaves();
      files.forEach((file) => {
        state.graph.affected(file.data.id).forEach(id => affectedSet.add(id));
      });
    } else if (linkFocus) {
      state.graph.affected(linkFocus.data.id).forEach(id => affectedSet.add(id));
    }
    const affectedNodes = [...affectedSet];
    const filtered = linkFocus ? links
      .filter(link => affectedNodes
        .indexOf(link.source.data.id) !== -1 || affectedNodes.indexOf(link.target.data.id) !== -1)
      : links;

    paths.style('display', d => (filtered.indexOf(d) !== -1 ? 'inline' : 'none'));

    d3.selectAll('.highlight').classed('highlight', false);

    affectedNodes.forEach((key) => {
      const nnn = map.get(key);
      if (!nnn) {
        console.warn('missing node', key);
        return;
      }
      d3.select(`#${nnn.data.url}`).classed('highlight', true);
    });
  }

  function onNodeClick(n) {
    d3.event.stopPropagation();

    d3.select('.focus').classed('focus', false);
    if (!n || linkFocus === n || n === root) {
      linkFocus = null;
    } else {
      d3.select(this).classed('focus', true);
      linkFocus = n;
    }
    svg.select('.circles').classed('mode-highlight', !!linkFocus);
    filterLinks();
  }
}

const f = flow();
window.flow = f;

if (window.dependencies) {
  f.setState({
    links: window.dependencies.links,
    modules: window.dependencies.modules,
  });
} else if (window.WSPath) {
  const ws = new WebSocket(`ws://${window.WSPath}`);
  ws.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    const { links, modules } = data;
    f.setState({
      links,
      modules,
    });
  });
}
