const uiLog = (text) => {
  try {
    figma.ui.postMessage({ type: "log", text });
  } catch (_) {
  }
};
const log = (...a) => {
  console.log("[YY-Scan]", ...a);
  uiLog(a.map(String).join(" "));
};
const ok = (m) => {
  figma.notify(`\u2705 ${m}`);
  uiLog(`\u2705 ${m}`);
};
const err = (m) => {
  figma.notify(`\u26A0\uFE0F ${m}`);
  uiLog(`\u26A0\uFE0F ${m}`);
};
figma.showUI(`<html><body><div id="out" style="font:12px/1.4 ui-monospace,monospace;white-space:pre;max-width:380px"></div>
<button id="ok">Scan all selected</button>
<script>
  const out = document.getElementById('out');
  const log = (m) => out.textContent += m + "\\n";
  window.onmessage = (e) => { const msg = e.data.pluginMessage; if (msg?.type==='log') log(msg.text); };
  document.getElementById('ok').onclick = () => parent.postMessage({ pluginMessage: { type: 'scan-confirm' }}, '*');
<\/script></body></html>`, { width: 420, height: 240 });
function getSelectedFrameOrThrow(frameData2) {
  log("Scanning selection...");
  const scanId = String(Date.now());
  const sel = figma.currentPage.selection;
  log("Selection count:", sel.length);
  if (sel.length === 0) {
    log("No selection \u2192 scanning variables only");
    return { frame: null, scanId, note: "no-selection" };
  }
  const first = sel.find((n) => n.type === "FRAME") || null;
  if (!first) {
    log("First selected node is not a FRAME \u2192 variables-only");
    return { frame: null, scanId, note: "non-frame" };
  }
  if (sel.length > 1) {
    log(`Multiple selected (${sel.length}). Using first frame now: ${first.name}`);
    figma.ui.onmessage = (msg) => {
      if ((msg == null ? void 0 : msg.type) === "scan-confirm") {
        log("UI confirm received (scan all) \u2014 TODO: expand to multi-frame scan later.");
      }
    };
  } else {
    log(`One frame selected: ${first.name}`);
  }
  ok("Selection data pushed");
  return { frame: first, scanId, note: "frame-selected" };
}
function collectContextAndVariables(input) {
  log("Getting context and variable data...");
  const meta = {
    fileName: figma.root.name,
    pageName: figma.currentPage.name,
    scanId: input.scanId,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  const hasVarAPI = figma.variables && typeof figma.variables.getLocalVariableCollections === "function";
  const variables = hasVarAPI ? figma.variables.getLocalVariableCollections().map((c) => ({ id: c.id, name: c.name })) : [];
  let nodes = null;
  if (input.frame) {
    const f = input.frame;
    nodes = {
      kind: "frame-snapshot",
      id: f.id,
      name: f.name,
      absPos: { x: f.x, y: f.y },
      size: { w: f.width, h: f.height }
      // TODO: add autolayout / fills / text / variable bindings later
    };
  }
  ok("Context and variables collected");
  return { meta, variables, nodes };
}
function buildAndStoreReport(scan) {
  log("Compiling report...");
  const text = JSON.stringify(
    {
      $schema: "yy://scan.schema.v0",
      // placeholder; harmless
      meta: scan.meta,
      variables: {
        collectionsCount: Array.isArray(scan.variables) ? scan.variables.length : 0,
        collections: scan.variables
      },
      nodes: scan.nodes
    },
    null,
    2
  );
  const name = "yy_scan";
  let page = figma.root.children.find((p) => p.name === name);
  if (!page) {
    page = figma.createPage();
    page.name = name;
  }
  figma.currentPage = page;
  page.children.forEach((n) => n.remove());
  const t = figma.createText();
  page.appendChild(t);
  return figma.loadFontAsync({ family: "Inter", style: "Regular" }).catch(() => {
  }).then(() => {
    t.characters = text;
    t.x = 40;
    t.y = 40;
    ok("Report written to page \u201Cyy_scan\u201D");
  });
}
log("Plugin started");
figma.notify("Plugin started");
const frameData = getSelectedFrameOrThrow();
const scanData = collectContextAndVariables(frameData);
buildAndStoreReport(scanData).catch((e) => err(String((e == null ? void 0 : e.message) || e)));
ok("Scan complete");
