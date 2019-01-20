const path = require('path');
const deps = require('../../index');

const data = {
  links: [
    ['a', 'b'],
  ],
  modules: {
    a: { size: 10 },
    b: { size: 15 },
  },
};

describe('api', () => {
  describe('build', () => {
    it('should create a static bundle', async () => {
      await deps.build(data, {
        dir: path.resolve(process.cwd(), 'generated'),
      });
      await page.goto(`file:///${path.resolve(process.cwd(), 'generated', 'dependency-flow.html')}`);

      const circles = await page.$$('.circles circle');
      expect(circles.length).to.equal(2);
    });
  });

  describe('serve', () => {
    it('should render provided data', async () => {
      const s = deps.serve();
      s.update(data);
      await page.goto('http://localhost:3001');

      const circles = await page.$$('.circles circle');
      expect(circles.length).to.equal(2);
    });
  });
});
