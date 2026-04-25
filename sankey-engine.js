// Full Sankey Rendering Engine
// Based on TASA EFX rLCA 8-Tier Sankey Diagram

(function(window) {
  'use strict';
  
  // ── Constants ─────────────────────────────────────────────
  const TOP = 72;
  const LPAD = 16;
  const FULL_H = 900;
  const BOX_GAP = 3;
  const MIN_BOX = 10;
  const LEAF_GAP = 2;
  
  // Column widths
  const ANC_W = 110;
  const SC_W = 90;
  const T1_W = 160;
  const T1L_W = 78;
  const T2_W = 145;
  const T2L_W = 78;
  const T3_W = 135;
  const T3L_W = 78;
  const GAP = 82;
  
  // X positions
  const ANC_X = LPAD;
  const SC_X = ANC_X + ANC_W + GAP;
  const T1_X = SC_X + SC_W + GAP;
  const T1L_X = T1_X + T1_W + GAP;
  const T2_X = T1L_X + T1L_W + GAP;
  const T2L_X = T2_X + T2_W + GAP;
  const T3_X = T2L_X + T2L_W + GAP;
  const T3L_X = T3_X + T3_W + GAP;
  
  // Colors
  const S_COLORS = ['#3A86C8', '#2BAE96', '#1B4F8A'];
  const T1_COLORS = ['#27AE8F','#2E86C1','#1D8A6E','#2471A3','#1A7A60','#1F6FA3','#17725A','#1A5F8C','#136150','#174F78','#8B7355'];
  const T2_COLORS = ['#5B9BD5','#70C1A8','#A0C4E8','#8FD8C4','#C2DFF2','#B0E8D8','#D8EEF8','#D0F0E8','#7BB8E0','#95D4BE','#E8C99A','#D4B07A','#C09060','#A87040','#9A6535','#8B5A2A'];
  const T3_COLORS = ['#F4A460','#DEB887','#CD853F','#D2691E','#8B4513','#A0522D','#BC8F5F','#E8A87C','#F5CBA7','#FAD7A0','#F0B27A','#E59866','#CA6F1E','#B7950B','#9A7D0A','#7D6608','#6E2F1A','#512E5F','#6C3483','#7D3C98'];
  
  // ── SankeyRenderer Class ──────────────────────────────────
  class SankeyRenderer {
    constructor(canvas, data) {
      this.canvas = canvas;
      this.data = data;
      this.ctx = null;
      this.dpr = window.devicePixelRatio || 1;
      this.hitBoxes = [];
      this.tooltip = document.getElementById('tooltip');
      
      this.setupCanvas();
      this.setupEventListeners();
    }
    
    getTotalWidth() {
      return T3L_X + T3L_W + LPAD + 10;
    }
    
    getTotalHeight() {
      return TOP + FULL_H + 40;
    }
    
    setupCanvas() {
      const W = this.getTotalWidth();
      const H = this.getTotalHeight();
      this.canvas.width = W * this.dpr;
      this.canvas.height = H * this.dpr;
      this.canvas.style.width = W + 'px';
      this.canvas.style.height = H + 'px';
      this.ctx = this.canvas.getContext('2d');
      this.ctx.scale(this.dpr, this.dpr);
    }
    
    setupEventListeners() {
      this.canvas.addEventListener('mousemove', (e) => {
        const cr = this.canvas.getBoundingClientRect();
        const mx = (e.clientX - cr.left) * (this.getTotalWidth() / cr.width);
        const my = (e.clientY - cr.top) * (this.getTotalHeight() / cr.height);
        
        const hit = this.hitBoxes.find(b => 
          mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h
        );
        
        if (hit && this.tooltip) {
          this.tooltip.innerHTML = hit.tip;
          this.tooltip.style.display = 'block';
          this.tooltip.style.left = (e.clientX + 14) + 'px';
          this.tooltip.style.top = (e.clientY - 10) + 'px';
        } else if (this.tooltip) {
          this.tooltip.style.display = 'none';
        }
      });
      
      this.canvas.addEventListener('mouseleave', () => {
        if (this.tooltip) this.tooltip.style.display = 'none';
      });
    }
    
    hexToRgb(hex) {
      return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
      ];
    }
    
    rgbaStr(hex, a) {
      const [r, g, b] = this.hexToRgb(hex);
      return `rgba(${r},${g},${b},${a})`;
    }
    
    rRect(x, y, w, h, r) {
      this.ctx.beginPath();
      if (this.ctx.roundRect) {
        this.ctx.roundRect(x, y, w, h, r);
      } else {
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.arcTo(x + w, y, x + w, y + r, r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.arcTo(x, y + h, x, y + h - r, r);
        this.ctx.lineTo(x, y + r);
        this.ctx.arcTo(x, y, x + r, y, r);
        this.ctx.closePath();
      }
    }
    
    proportionalHeights(pcts, totalH, gap) {
      const n = pcts.length;
      const tot = pcts.reduce((a, b) => a + b, 0) || 1;
      const available = totalH - gap * (n - 1);
      let heights = pcts.map(p => Math.max(MIN_BOX, (p / tot) * available));
      
      let diff = heights.reduce((a, b) => a + b, 0) - available;
      if (Math.abs(diff) > 0.5) {
        const adj = heights.map((h, i) => ({i, h}))
          .filter(o => o.h > MIN_BOX)
          .sort((a, b) => b.h - a.h);
        
        for (const o of adj) {
          const cut = Math.min(Math.abs(diff), heights[o.i] - MIN_BOX);
          heights[o.i] -= Math.sign(diff) * cut;
          diff -= Math.sign(diff) * cut;
          if (Math.abs(diff) < 0.5) break;
        }
      }
      
      return heights;
    }
    
    drawBox(x, y, w, h, color, label, pct, val, fs = 9) {
      if (h < 4) return;
      
      const [r, g, b] = this.hexToRgb(color);
      const grad = this.ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, `rgba(${Math.min(r + 30, 255)},${Math.min(g + 30, 255)},${Math.min(b + 30, 255)},1)`);
      grad.addColorStop(1, color);
      
      this.ctx.fillStyle = grad;
      this.rRect(x, y, w, h, 4);
      this.ctx.fill();
      
      this.ctx.strokeStyle = `rgba(${Math.max(r - 20, 0)},${Math.max(g - 20, 0)},${Math.max(b - 20, 0)},0.3)`;
      this.ctx.lineWidth = 0.7;
      this.rRect(x, y, w, h, 4);
      this.ctx.stroke();
      
      if (h < 8) return;
      
      this.ctx.textBaseline = 'middle';
      this.ctx.textAlign = 'left';
      const px = x + 6;
      const maxW = w - 10;
      
      if (h >= 22) {
        this.ctx.font = `600 ${fs}px Inter`;
        this.ctx.fillStyle = 'rgba(255,255,255,0.95)';
        let txt = label;
        while (this.ctx.measureText(txt).width > maxW && txt.length > 3) {
          txt = txt.slice(0, -1);
        }
        if (txt !== label) txt = txt.slice(0, -1) + '…';
        this.ctx.fillText(txt, px, y + h * 0.35);
        
        this.ctx.font = `${fs - 1}px Inter`;
        this.ctx.fillStyle = 'rgba(255,255,255,0.70)';
        this.ctx.fillText(parseFloat(pct).toFixed(2) + '%', px, y + h * 0.68);
      } else if (h >= 14) {
        this.ctx.font = `${fs - 1}px Inter`;
        this.ctx.fillStyle = 'rgba(255,255,255,0.88)';
        this.ctx.fillText(parseFloat(pct).toFixed(2) + '%', px, y + h / 2);
      }
    }
    
    drawRibbon(x1, y1t, y1b, x2, y2t, y2b, color, alpha) {
      const mx = x1 + (x2 - x1) * 0.52;
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1t);
      this.ctx.bezierCurveTo(mx, y1t, mx, y2t, x2, y2t);
      this.ctx.lineTo(x2, y2b);
      this.ctx.bezierCurveTo(mx, y2b, mx, y1b, x1, y1b);
      this.ctx.closePath();
      this.ctx.fillStyle = this.rgbaStr(color, alpha);
      this.ctx.fill();
    }
    
    drawHeader(x, w, l1, l2) {
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = '#0D2F4F';
      this.ctx.font = "700 10px Inter";
      this.ctx.fillText(l1, x + w / 2, TOP - (l2 ? 24 : 14));
      
      if (l2) {
        this.ctx.font = "400 8px Inter";
        this.ctx.fillStyle = '#4A6A8A';
        this.ctx.fillText(l2, x + w / 2, TOP - 11);
      }
      
      this.ctx.strokeStyle = 'rgba(26,63,100,0.15)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x + 4, TOP - 3);
      this.ctx.lineTo(x + w - 4, TOP - 3);
      this.ctx.stroke();
    }
    
    regHit(x, y, w, h, label, pct, val) {
      this.hitBoxes.push({
        x, y, w, h,
        tip: `<b>${label}</b><br>${parseFloat(pct).toFixed(2)}% of total<br>${Math.round(val)} Mg CO₂e / M USD`
      });
    }
    
    render(mode, combineT2, combineT3) {
      this.hitBoxes = [];
      this.ctx.clearRect(0, 0, this.getTotalWidth(), this.getTotalHeight());
      
      // Background
      this.ctx.fillStyle = '#0a1628';
      this.ctx.fillRect(0, 0, this.getTotalWidth(), this.getTotalHeight());
      
      // Headers
      this.drawHeader(ANC_X, ANC_W, 'BASELINE', 'EMISSIONS');
      this.drawHeader(SC_X, SC_W, 'SCOPE', null);
      this.drawHeader(T1_X, T1_W, 'TIER 1', 'Input Sector');
      this.drawHeader(T1L_X, T1L_W, 'TIER 1', mode === 'detail' ? 'SCOPE (each)' : 'SCOPE (sum)');
      this.drawHeader(T2_X, T2_W, 'TIER 2', combineT2 ? 'Input (combined)' : 'Input Sector');
      this.drawHeader(T2L_X, T2L_W, 'TIER 2', mode === 'detail' ? 'SCOPE (each)' : 'SCOPE (sum)');
      this.drawHeader(T3_X, T3_W, 'TIER 3', combineT3 ? 'Input (combined)' : 'Input Sector');
      this.drawHeader(T3L_X, T3L_W, 'TIER 3', mode === 'detail' ? 'SCOPE (each)' : 'SCOPE (sum)');
      
      // Anchor (baseline)
      this.drawAnchor();
      
      // Scope boxes
      const scopeBoxes = this.drawScopes();
      
      // Tier 1
      const t1Boxes = this.drawTier1(scopeBoxes);
      
      // Tier 1 Leaves
      const t1LeafBoxes = this.drawTier1Leaves(t1Boxes, mode);
      
      // Tier 2 (simplified - would be full implementation with actual data)
      this.drawTier2Simple(t1LeafBoxes, mode, combineT2);
      
      // Footer text
      this.ctx.fillStyle = '#4A6A8A';
      this.ctx.font = '400 9px Inter';
      this.ctx.textAlign = 'left';
      this.ctx.fillText(
        `Emissions Intensity (Mg CO₂e per Million USD) · ${this.data.sector}`,
        ANC_X,
        TOP + FULL_H + 20
      );
    }
    
    drawAnchor() {
      const chev = 16;
      const aGrad = this.ctx.createLinearGradient(ANC_X, TOP, ANC_X, TOP + FULL_H);
      aGrad.addColorStop(0, '#1A4A72');
      aGrad.addColorStop(1, '#0D2F4F');
      
      this.ctx.fillStyle = aGrad;
      this.ctx.beginPath();
      this.ctx.moveTo(ANC_X, TOP);
      this.ctx.lineTo(ANC_X + ANC_W - chev, TOP);
      this.ctx.lineTo(ANC_X + ANC_W, TOP + FULL_H / 2);
      this.ctx.lineTo(ANC_X + ANC_W - chev, TOP + FULL_H);
      this.ctx.lineTo(ANC_X, TOP + FULL_H);
      this.ctx.closePath();
      this.ctx.fill();
      
      const ancCX = ANC_X + (ANC_W - chev) / 2;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.font = "700 11px Inter";
      this.ctx.fillStyle = '#fff';
      
      const words = this.data.sector.split(' ');
      let line = '', lines = [];
      words.forEach(w => {
        if ((line + ' ' + w).trim().length * 6.5 > ANC_W - 20 && line) {
          lines.push(line);
          line = w;
        } else {
          line = (line + ' ' + w).trim();
        }
      });
      lines.push(line);
      
      lines.forEach((l, i) => 
        this.ctx.fillText(l, ancCX, TOP + FULL_H * 0.38 + (i - lines.length / 2) * 13)
      );
      
      this.ctx.font = "400 8px Inter";
      this.ctx.fillStyle = 'rgba(255,255,255,0.65)';
      this.ctx.fillText(Math.round(this.data.total_ei) + ' Mg CO₂e/M$', ancCX, TOP + FULL_H * 0.55);
      
      this.regHit(ANC_X, TOP, ANC_W, FULL_H, this.data.sector, 100, this.data.total_ei);
    }
    
    drawScopes() {
      const scPcts = this.data.scopes.map(s => s.pct);
      const scHeights = this.proportionalHeights(scPcts, FULL_H, BOX_GAP);
      const scY_arr = [];
      let sy = TOP;
      scHeights.forEach(h => {
        scY_arr.push(sy);
        sy += h + BOX_GAP;
      });
      
      // Draw ribbons from anchor
      const chev = 16;
      let ancCursor = TOP;
      this.data.scopes.forEach((sc, si) => {
        const share = sc.pct / scPcts.reduce((a, b) => a + b, 0);
        this.drawRibbon(
          ANC_X + ANC_W - chev, ancCursor, ancCursor + share * FULL_H,
          SC_X, scY_arr[si], scY_arr[si] + scHeights[si],
          sc.color, 0.22
        );
        ancCursor += share * FULL_H;
      });
      
      // Draw scope boxes
      const scopeBoxes = [];
      this.data.scopes.forEach((sc, si) => {
        this.drawBox(SC_X, scY_arr[si], SC_W, scHeights[si], sc.color, sc.label, sc.pct, sc.val, 10);
        this.regHit(SC_X, scY_arr[si], SC_W, scHeights[si], sc.label, sc.pct, sc.val);
        scopeBoxes.push({y: scY_arr[si], h: scHeights[si], color: sc.color, pct: sc.pct, val: sc.val});
      });
      
      return scopeBoxes;
    }
    
    drawTier1(scopeBoxes) {
      const t1Pcts = this.data.tier1.map(t => t.pct);
      const t1Heights = this.proportionalHeights(t1Pcts, FULL_H, BOX_GAP);
      
      const s3box = scopeBoxes[2];
      let t1Y = TOP;
      let s3cursor = s3box.y;
      const s3tot = s3box.pct || 1;
      
      // Draw ribbons
      this.data.tier1.forEach((t, i) => {
        const h = t1Heights[i];
        const col = T1_COLORS[i % T1_COLORS.length];
        const sliceH = (t.pct / s3tot) * s3box.h;
        this.drawRibbon(SC_X + SC_W, s3cursor, s3cursor + sliceH, T1_X, t1Y, t1Y + h, col, 0.20);
        s3cursor += sliceH;
        t1Y += h + BOX_GAP;
      });
      
      // Draw boxes
      t1Y = TOP;
      const t1Boxes = [];
      this.data.tier1.forEach((t, i) => {
        const h = t1Heights[i];
        const col = T1_COLORS[i % T1_COLORS.length];
        t1Boxes.push({y: t1Y, h, color: col, pct: t.pct, val: t.val, label: t.label});
        this.drawBox(T1_X, t1Y, T1_W, h, col, t.label, t.pct, t.val, 9);
        this.regHit(T1_X, t1Y, T1_W, h, 'Tier 1: ' + t.label, t.pct, t.val);
        t1Y += h + BOX_GAP;
      });
      
      return t1Boxes;
    }
    
    drawTier1Leaves(t1Boxes, mode) {
      const t1LeafBoxes = [];
      
      if (mode === 'detail') {
        const allLPcts = [];
        this.data.tier1.forEach(t => allLPcts.push(t.s1, t.s2, t.s3));
        const N = allLPcts.length;
        const lAvail = FULL_H - LEAF_GAP * (N - 1);
        const lTot = allLPcts.reduce((a, b) => a + b, 0) || 1;
        const MIN_L = Math.max(4, lAvail / N * 0.20);
        let allLH = allLPcts.map(p => Math.max(MIN_L, (p / lTot) * lAvail));
        const lsum = allLH.reduce((a, b) => a + b, 0);
        allLH = allLH.map(h => h / lsum * lAvail);
        
        let fi = 0, leafY = TOP;
        this.data.tier1.forEach((t, i) => {
          const tb = t1Boxes[i];
          const lPcts = [t.s1, t.s2, t.s3];
          const lVals = [t.s1_val, t.s2_val, t.s3_val];
          const lhs = [allLH[fi], allLH[fi + 1], allLH[fi + 2]];
          const ptot = lPcts.reduce((a, b) => a + b, 0) || 1;
          let t1cur = tb.y;
          
          lhs.forEach((lh, si) => {
            const sliceH = (lPcts[si] / ptot) * tb.h;
            this.drawRibbon(T1_X + T1_W, t1cur, t1cur + sliceH, T1L_X, leafY, leafY + lh, S_COLORS[si], 0.20);
            t1cur += sliceH;
            t1LeafBoxes.push({y: leafY, h: lh, color: S_COLORS[si], pct: lPcts[si], val: lVals[si], t1idx: i, si});
            leafY += lh + LEAF_GAP;
          });
          fi += 3;
        });
        
        t1LeafBoxes.forEach(b => {
          this.drawBox(T1L_X, b.y, T1L_W, b.h, b.color, ['Scope 1', 'Scope 2', 'Scope 3'][b.si], b.pct, b.val, 8);
          this.regHit(T1L_X, b.y, T1L_W, b.h, this.data.tier1[b.t1idx].label + ' · ' + ['Scope 1', 'Scope 2', 'Scope 3'][b.si], b.pct, b.val);
        });
      } else {
        const smP = [
          this.data.tier1.reduce((a, t) => a + t.s1, 0),
          this.data.tier1.reduce((a, t) => a + t.s2, 0),
          this.data.tier1.reduce((a, t) => a + t.s3, 0)
        ];
        const smV = [
          this.data.tier1.reduce((a, t) => a + t.s1_val, 0),
          this.data.tier1.reduce((a, t) => a + t.s2_val, 0),
          this.data.tier1.reduce((a, t) => a + t.s3_val, 0)
        ];
        const smH = this.proportionalHeights(smP, FULL_H, BOX_GAP);
        
        // Draw ribbons
        this.data.tier1.forEach((t, i) => {
          const tb = t1Boxes[i];
          const lP = [t.s1, t.s2, t.s3];
          const ptot = lP.reduce((a, b) => a + b, 0) || 1;
          let t1cur = tb.y, bucketY = TOP;
          
          smH.forEach((bh, si) => {
            const sliceH = (lP[si] / ptot) * tb.h;
            this.drawRibbon(T1_X + T1_W, t1cur, t1cur + sliceH, T1L_X, bucketY, bucketY + bh, S_COLORS[si], 0.12);
            t1cur += sliceH;
            bucketY += bh + BOX_GAP;
          });
        });
        
        let smY = TOP;
        smH.forEach((h, si) => {
          const lbl = ['Scope 1', 'Scope 2', 'Scope 3'][si];
          this.drawBox(T1L_X, smY, T1L_W, h, S_COLORS[si], lbl, smP[si], smV[si], 9);
          this.regHit(T1L_X, smY, T1L_W, h, 'Tier 1 ' + lbl + ' (all)', smP[si], smV[si]);
          t1LeafBoxes.push({y: smY, h, color: S_COLORS[si], pct: smP[si], val: smV[si], t1idx: -1, si});
          smY += h + BOX_GAP;
        });
      }
      
      return t1LeafBoxes;
    }
    
    drawTier2Simple(t1LeafBoxes, mode, combine) {
      // Simplified Tier 2/3 rendering
      // In full implementation, would load actual tier data
      
      this.ctx.fillStyle = '#506E8C';
      this.ctx.font = '400 11px Inter';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('Tier 2-3 data requires full pathway sheets', T2_X + T2_W / 2, TOP + FULL_H / 2);
      this.ctx.font = '400 9px Inter';
      this.ctx.fillText('(Load Tier_2 and Tier_3 sheets for complete visualization)', T2_X + T2_W / 2, TOP + FULL_H / 2 + 16);
    }
  }
  
  // Export to window
  window.SankeyRenderer = SankeyRenderer;
  
})(window);
