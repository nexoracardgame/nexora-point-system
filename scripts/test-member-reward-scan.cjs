const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function scannerHarness(mode, response) {
  const states = [];
  const callbacks = [];
  const requests = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useRef: () => ({ current: null }),
    useMemo: (fn) => fn(),
    useEffect: () => {},
    useCallback: (fn) => { callbacks.push(fn); return fn; },
  };
  const mod = { exports: {} };
  const source = fs.readFileSync('app/staff/StaffCouponScanner.tsx', 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports: mod.exports,
    require(name) {
      if (name === 'react') return react;
      if (name.startsWith('@/lib/card-')) return {
        extractCardRareCode: (code) => code.startsWith('NXR-RARE-') ? code : '',
        extractCardSetCode: (code) => code.startsWith('NXR-SET-') ? code : '',
      };
      if (name === '@/lib/nexora-dialog') return {
        nexoraAlert: () => {}, nexoraConfirm: () => { throw Error('Member must not auto-use coupons'); },
      };
      if (name === '@/lib/thai-time') return { formatThaiDateTime: () => 'date' };
      return require(name);
    },
    fetch: async (url) => { requests.push(url); return { ok: true, json: async () => response }; },
  });
  return {
    requests,
    render() { cursor = 0; callbacks.length = 0; return mod.exports.default({ mode }); },
    lookup(code) { return callbacks.find((fn) => fn.toString().includes('manualCode'))(code, { promptUse: true }); },
  };
}

function nodes(tree, type) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, type));
  return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
}

(async () => {
  const memberMode = 'customer-admin-redemption';
  const coupon = scannerHarness(memberMode, { coupon: {
    code: 'NXR-NEX-10-1783683063195-ABCD', rewardName: 'Reward', used: false,
  } });
  coupon.render();
  await coupon.lookup('NXR-NEX-10-1783683063195-ABCD');
  assert.equal(coupon.requests.length, 1, 'Member coupon must reach the lookup API');
  const couponTree = coupon.render();
  assert.equal(nodes(couponTree, 'h2').length, 0, 'No false permission dialog');
  assert(nodes(couponTree, 'button').some((b) => b.props.disabled && b.props.onClick?.toString().includes('confirmCouponUse')));

  for (const kind of ['SET', 'RARE']) {
    for (const adminIssued of [false, true]) {
      for (const mode of [memberMode, 'staff']) {
        const scanner = scannerHarness(mode, { redemption: {
          code: `NXR-${kind}-1-1783683063195-ABCD`, status: 'pending',
          createdByAdminMode: adminIssued, valueLabel: '100 NEX',
        } });
        scanner.render();
        await scanner.lookup(`NXR-${kind}-1-1783683063195-ABCD`);
        const tree = scanner.render();
        assert.equal(nodes(tree, 'h2').length, 0, 'Own regular redemption must display');
        const actionButtons = nodes(tree, 'button').filter((b) => /confirmCard(Set|Rare)Action/.test(b.props.onClick?.toString()));
        assert.equal(actionButtons.length, 2);
        for (const button of actionButtons) {
          assert.equal(Boolean(button.props.disabled), mode === memberMode && !adminIssued);
        }
      }
    }
  }
  console.log('PASS: member coupon lookup, own SET/RARE lookup, admin-issued claims, staff actions');
})().catch((error) => { console.error(error); process.exitCode = 1; });
