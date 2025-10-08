/// <reference types="@figma/plugin-typings" />

const uiLog = (text: string) => { try { figma.ui.postMessage({ type: "log", text }); } catch (_) {} };
const log= (...a: any[]) => { console.log("[YY-Scan]", ...a); uiLog(a.map(String).join(" ")); };
const ok= (m: string)   => { figma.notify(`✅ ${m}`); uiLog(`✅ ${m}`); };
const err= (m: string)   => { figma.notify(`⚠️ ${m}`); uiLog(`⚠️ ${m}`); };

figma.showUI(`<html><body><div id="out" style="font:12px/1.4 ui-monospace,monospace;white-space:pre;max-width:380px"></div>
<button id="ok">Scan all selected</button>
<script>
  const out = document.getElementById('out');
  const log = (m) => out.textContent += m + "\\n";
  window.onmessage = (e) => { const msg = e.data.pluginMessage; if (msg?.type==='log') log(msg.text); };
  document.getElementById('ok').onclick = () => parent.postMessage({ pluginMessage: { type: 'scan-confirm' }}, '*');
</script></body></html>`, { width: 420, height: 240 });

// ——— 1) selection ———
    function getSelectedFrameOrThrow(frameData):{ frame: FrameNode | null; scanId: string; note: string } /* returns the frame or throws */ {
        log("Scanning selection...");
        const scanId = String(Date.now());
        const sel = figma.currentPage.selection as readonly SceneNode[];
        log("Selection count:", sel.length);

        if (sel.length === 0) {
            log("No selection → scanning variables only");
            return { frame: null, scanId, note: "no-selection" };
        }

    // pick first FRAME; if none, treat as no-selection
        const first = (sel.find(n => n.type === "FRAME") as FrameNode) || null;

        if (!first) {
            log("First selected node is not a FRAME → variables-only");
            return { frame: null, scanId, note: "non-frame" };
        }

        if (sel.length > 1) {
            log(`Multiple selected (${sel.length}). Using first frame now: ${first.name}`);
            // NOTE: UI button posts {type:'scan-confirm'}; you can handle scanning *all* inside onmessage if you want later.
            figma.ui.onmessage = (msg) => {
                if (msg?.type === "scan-confirm") {
                    log("UI confirm received (scan all) — TODO: expand to multi-frame scan later.");
                }
            };
        } else {
            log(`One frame selected: ${first.name}`);
        }

        ok("Selection data pushed")
        return { frame: first, scanId, note: "frame-selected" };
    }

// ——— 2) context + variables ———
    function collectContextAndVariables(input: { frame: FrameNode | null; scanId: string }) /* collects variables and scans page */ {
        log("Getting context and variable data...");

        const meta = {
            fileName: figma.root.name,
            pageName: figma.currentPage.name,
            scanId: input.scanId,
            timestamp: new Date().toISOString(),
        };

    // minimal variables info so 'variables' exists
        const hasVarAPI =
            (figma as any).variables &&
            typeof (figma as any).variables.getLocalVariableCollections === "function";

        const variables = hasVarAPI
            ? (figma as any).variables.getLocalVariableCollections().map((c: any) => ({ id: c.id, name: c.name }))
            : [];

        let nodes: any = null;
        if (input.frame) {
            const f = input.frame;
            nodes = {
                kind: "frame-snapshot",
                id: f.id,
                name: f.name,
                absPos: { x: f.x, y: f.y },
                size: { w: f.width, h: f.height },
                // TODO: add autolayout / fills / text / variable bindings later
            };
        }

        ok("Context and variables collected");
        return { meta, variables, nodes };
    }

// ——— 3) report ———
    function buildAndStoreReport(scan: { meta: any; variables: any; nodes: any }) /* builds up and saves report (maybe add fuctionality for sendtoAI=true) */ {
            log("Compiling report...")

    // • Add $schema and meta block near the top
        const text = JSON.stringify(
            {
                $schema: "yy://scan.schema.v0", // placeholder; harmless
                meta: scan.meta,
                variables: {
                    collectionsCount: Array.isArray(scan.variables) ? scan.variables.length : 0,
                    collections: scan.variables,
                },
                nodes: scan.nodes,
            },
            null,
            2
        );

        const name = "yy_scan";
        let page = figma.root.children.find(p => p.name === name) as PageNode | undefined;
        if (!page) { page = figma.createPage(); page.name = name; }
        figma.currentPage = page;

// • clear previous content (optional)
        page.children.forEach(n => n.remove());

        const t = figma.createText();
        page.appendChild(t);

        return figma.loadFontAsync({ family: "Inter", style: "Regular" })
            .catch(() => {})
            .then(() => {
                t.characters = text;
                t.x = 40; t.y = 40;
                ok("Report written to page “yy_scan”");
            });
}




log("Plugin started");
figma.notify("Plugin started");

const frameData = getSelectedFrameOrThrow();
const scanData  = collectContextAndVariables(frameData);
buildAndStoreReport(scanData).catch(e => err(String(e?.message || e)));

ok("Scan complete");




