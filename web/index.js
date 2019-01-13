import * as d3 from 'd3';

import tableToTree from './table-to-tree';

function flow() {
  const links = [];
  const rect = document.body.getBoundingClientRect();

  const svg = d3.select('svg');
  svg.append('g').attr('class', 'circles');
  svg.append('g').attr('class', 'links').attr('pointer-events', 'none');
  svg.append('g').attr('class', 'labels').attr('pointer-events', 'none');
  svg.attr('width', rect.width);
  svg.attr('height', rect.height - 4);
  svg.attr('viewBox', `-${rect.width / 2} -${rect.height / 2} ${rect.width} ${rect.height}`);

  svg.on('click', () => onNodeClick(null));

  const size = Math.min(rect.width, rect.height) * 0.9;

  const pack = d3.pack()
    .size([size, size])
    .padding(0);

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
    update(data) {
      let uid = 0;
      links.length = 0;

      const h = d3.hierarchy(data);

      h.eachBefore((n) => {
        const p = n.parent ? n.parent.data.id : '';
        n.data.id = n.parent ? `${p ? `${p}/` : p}${n.data.name}` : '';
        n.data.url = `uid-${++uid}`;
        n.data.displayName = n.data.displayName || n.data.name;
        if (n.children && n.children.length === 1) {
          n.children[0].data.displayName = p ? `${n.data.displayName}/${n.children[0].data.name}` : n.children[0].data.name;
          n.data.displayName = '';
        }
      });
      map = new Map(h.descendants().map(d => [d.data.id, d]));

      h.sum(() => 1)
        .sort((a, b) => b.value - a.value);

      root = pack(h);
      let maxDistance = 0;

      for (const leaf of root.leaves()) {
        for (const i of leaf.data.imports) {
          const n = map.get(i);
          const common = leaf.path(n);
          maxDistance = Math.max(common.length, maxDistance);
          links.push({
            source: leaf,
            target: n,
            chain: common,
          });
        }
      }
      const distance = d3.scaleSequential(d3.interpolateRdYlGn).domain([maxDistance, 3]);

      node = svg.select('.circles')
        .selectAll('circle')
        .data(root.descendants().slice(1), d => d.data.id);

      node.exit().remove();

      node = node
        .enter()
        .append('circle')
        .on('click', onNodeClick)
        .merge(node)
        .attr('id', d => `${d.data.url}`);

      paths = svg.select('.links')
        .selectAll('path')
        .data(links, d => `${d.source.data.id} - ${d.target.data.id}`);

      paths.exit().remove();

      paths = paths
        .enter()
        .append('path')
        .merge(paths)
        .attr('stroke', d => distance(d.chain.length));

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
    const { k } = t;
    const dx = root.x - t.x / k;
    const dy = root.y - t.y / k;

    node.attr('transform', d => `translate(${(d.x - dx) * k},${(d.y - dy) * k})`);
    node.attr('r', d => d.r * t.k);

    lineFn = d3.line()
      .curve(d3.curveBundle.beta(0.8))
      .y(d => (d.y - dy) * k)
      .x(d => (d.x - dx) * k);

    paths.attr('d', d => lineFn(d.chain));

    label
      .attr('transform', d => `translate(${(d.x - dx) * k},${(d.y - dy) * k - d.r * t.k * 0.8})`)
      .style('font-size', d => d.r * t.k * 0.1)
      .style('display', d => (d.r * t.k > size * 0.1 ? 'inline' : 'none'));
  }

  function filterLinks() {
    const nn = linkFocus;
    const affectedNodes = {};

    const source = linkFocus ? nn.data.id : null;
    const filtered = linkFocus ? links.filter((link) => {
      const b = link.source.data.id.indexOf(source) === 0
        || link.target.data.id.indexOf(source) === 0;
      if (b) {
        link.chain.forEach((c) => {
          affectedNodes[c.data.id] = true;
        });
      }
      return b;
    }) : links;

    paths.style('display', d => (filtered.indexOf(d) !== -1 ? 'inline' : 'none'));

    d3.selectAll('.highlight').classed('highlight', false);

    Object.keys(affectedNodes).forEach((key) => {
      const nnn = map.get(key);
      d3.select(`#${nnn.data.url}`).classed('highlight', true);
    });
  }

  function onNodeClick(n) {
    d3.event.stopPropagation();

    d3.select('.focus').attr('class', '');
    if (!n || linkFocus === n || n === root) {
      linkFocus = null;
    } else {
      d3.select(this).attr('class', 'focus');
      linkFocus = n;
    }
    filterLinks();
  }
}

const f = flow();

const ws = new WebSocket('ws://localhost:5051');
ws.addEventListener('message', (event) => {
  f.update(tableToTree(JSON.parse(event.data)));
});
