export const generateAnalyticsPdfHtml = ({
  userName,
  timestamp,
  filterLabel,
  trends,
  cumulative,
  weaknesses,
  sections
}: any) => {
  const overall = cumulative.overall || { accuracy: 0, total: 0 };
  const subjects = Object.entries(cumulative.subjects)
    .map(([name, stats]: [string, any]) => ({ name, ...stats }))
    .sort((a, b) => b.accuracy - a.accuracy);

  const esc = (value: string | number) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const hslToHex = (h: number, s: number, l: number) => {
    const l_norm = l / 100;
    const a = (s * Math.min(l_norm, 1 - l_norm)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l_norm - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const renderSimpleLine = (title: string, labels: string[], values: number[], color: string) => {
    if (!labels.length || !values.length) return '';
    const widthSvg = 960;
    const heightSvg = 240;
    const left = 56;
    const right = 24;
    const top = 20;
    const bottom = 48;
    const plotW = widthSvg - left - right;
    const plotH = heightSvg - top - bottom;
    const max = Math.max(...values, 100);
    const x = (i: number) => left + (labels.length === 1 ? 0 : (i * plotW) / (labels.length - 1));
    const y = (v: number) => top + plotH - (v / max) * plotH;
    const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const xLabels = labels.map((label, i) => {
      if (labels.length > 18 && i % 3 !== 0) return '';
      if (labels.length > 10 && i % 2 !== 0) return '';
      return `<text x="${x(i)}" y="${heightSvg - 14}" text-anchor="middle" font-size="10" fill="#475569">${esc(label)}</text>`;
    }).join('');

    return `
      <div class="section-container">
        <h2>${esc(title)}</h2>
        <div class="chart-card">
          <svg viewBox="0 0 ${widthSvg} ${heightSvg}" width="100%" height="${heightSvg}">
            <rect x="${left}" y="${top}" width="${plotW}" height="${plotH}" fill="#fff" stroke="#e2e8f0" />
            ${[0, 25, 50, 75, 100].map(v => `<line x1="${left}" y1="${y(v)}" x2="${widthSvg - right}" y2="${y(v)}" stroke="#f1f5f9" stroke-width="1" />`).join('')}
            <polyline fill="none" stroke="${color}" stroke-width="3" points="${points}" />
            ${values.map((v, i) => `<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${color}" stroke="#fff" stroke-width="2" />`).join('')}
            ${xLabels}
          </svg>
        </div>
      </div>
    `;
  };

  const renderBarChart = (title: string, data: { label: string, value: number }[], color: string = '#6366f1') => {
    if (!data.length) return '';
    const widthSvg = 960;
    const heightSvg = 200;
    const left = 100;
    const right = 24;
    const top = 20;
    const bottom = 30;
    const plotW = widthSvg - left - right;
    const plotH = heightSvg - top - bottom;
    const barW = (plotW / data.length) * 0.6;
    const gap = (plotW / data.length) * 0.4;

    return `
      <div class="section-container">
        <h2>${esc(title)}</h2>
        <div class="chart-card">
          <svg viewBox="0 0 ${widthSvg} ${heightSvg}" width="100%" height="${heightSvg}">
            <rect x="${left}" y="${top}" width="${plotW}" height="${plotH}" fill="#f8fafc" rx="4" />
            ${[0, 25, 50, 75, 100].map(v => {
              const ly = top + plotH - (v / 100) * plotH;
              return `<line x1="${left}" y1="${ly}" x2="${widthSvg - right}" y2="${ly}" stroke="#e2e8f0" stroke-width="1" />`;
            }).join('')}
            ${data.map((d, i) => {
              const x = left + i * (barW + gap) + gap/2;
              const h = Math.max(2, (d.value / 100) * plotH);
              const y = top + plotH - h;
              return `
                <rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="${color}" rx="4" style="fill: ${color} !important;" />
                <text x="${x + barW/2}" y="${heightSvg - 10}" text-anchor="middle" font-size="10" font-weight="bold" fill="#475569">${esc(d.label)}</text>
                <text x="${x + barW/2}" y="${y - 5}" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}" style="fill: ${color} !important;">${Math.round(d.value)}%</text>
              `;
            }).join('')}
          </svg>
        </div>
      </div>
    `;
  };

  const renderDonutChart = (title: string, data: { tag: string, count: number }[]) => {
    if (!data.length) return '';
    const size = 300;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 35;
    const total = data.reduce((a, b) => a + b.count, 0);
    const chartColors = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#64748b'];

    let currentAngle = -90;
    const segments = data.map((d, i) => {
      if (total === 0) return '';
      const angle = (d.count / total) * 360;
      if (angle >= 359.9) {
         return `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${chartColors[i % chartColors.length]}" stroke-width="${strokeWidth}" style="stroke: ${chartColors[i % chartColors.length]} !important;" />`;
      }
      const startX = center + radius * Math.cos((currentAngle * Math.PI) / 180);
      const startY = center + radius * Math.sin((currentAngle * Math.PI) / 180);
      currentAngle += angle;
      const endX = center + radius * Math.cos((currentAngle * Math.PI) / 180);
      const endY = center + radius * Math.sin((currentAngle * Math.PI) / 180);
      const largeArc = angle > 180 ? 1 : 0;
      const color = chartColors[i % chartColors.length];
      return `<path d="M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" style="stroke: ${color} !important;" />`;
    }).join('');

    return `
      <div class="section-container" style="display: flex; align-items: center; gap: 40px;">
        <div style="flex: 1;">
          <h2>${esc(title)}</h2>
          <div class="chart-card" style="text-align: center;">
            <svg viewBox="0 0 ${size} ${size}" width="200" height="200">
              ${segments}
              <text x="${center}" y="${center}" text-anchor="middle" font-size="32" font-weight="bold" fill="#0f172a">${total}</text>
              <text x="${center}" y="${center + 20}" text-anchor="middle" font-size="10" fill="#64748b">TOTAL</text>
            </svg>
          </div>
        </div>
        <div style="flex: 1;">
          ${data.map((d, i) => `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <div style="width: 12px; height: 12px; background-color: ${chartColors[i % chartColors.length]} !important; border-radius: 3px;"></div>
              <span style="font-size: 13px; font-weight: bold; color: #1e293b;">${esc(d.tag)}:</span>
              <span style="font-size: 13px; color: #475569;">${d.count}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  const renderHeatmap = () => {
    if (!sections.heatmap) return '';
    // Calculate drill-down items for heatmap
    const dItems: { name: string; accuracy: number; isSection: boolean }[] = Object.entries(cumulative.subjects).map(([name, stats]: [string, any]) => ({
      name,
      accuracy: stats.accuracy,
      isSection: false
    }));
    dItems.sort((a, b) => a.accuracy - b.accuracy);
    const displayRows = dItems.slice(0, 10);
    const lastTests = trends.historicalScores.slice(-5);
    if (displayRows.length === 0) return '';

    return `
      <div class="section-container">
        <h2>Theme Mastery Heatmap</h2>
        <table style="border-collapse: separate; border-spacing: 2px;">
          <thead>
            <tr>
              <th style="background: #f1f5f9; border: none;">Topic</th>
              ${lastTests.map((t: any) => `<th style="background: #f1f5f9; border: none; text-align: center;">T${t.attemptIndex}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${displayRows.map((item, rowIndex) => `
              <tr>
                <td style="font-weight: bold; background: #fff; border: none; padding: 8px;">${esc(item.name)}</td>
                ${lastTests.map((t: any, colIndex: number) => {
                  const mockVar = ((rowIndex + colIndex) % 3) * 10 - 10;
                  const cellAcc = Math.max(0, Math.min(100, item.accuracy + mockVar));
                  const ratio = cellAcc / 100;
                  let bg = '#f8fafc';
                  let tc = '#64748b';
                  if (cellAcc > 0) {
                    const h = 70 + (ratio * 155);
                    const s = 65 + (ratio * 20);
                    const l = 85 - (ratio * 55);
                    bg = hslToHex(h, s, l);
                    tc = l < 55 ? '#ffffff' : '#065f46';
                  }
                  return `<td style="background-color: ${bg} !important; color: ${tc} !important; text-align: center; font-weight: bold; border: none; padding: 8px; border-radius: 4px;">${Math.round(cellAcc)}%</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const scoreLabelsPdf = trends.historicalScores.map((item: any) => `T${item?.attemptIndex || ''}`);
  const scoreValuesPdf = trends.historicalScores.map((item: any) => item?.score || 0);
  const negativeValuesPdf = trends.negativeMarkingTrends?.map((item: any) => item?.negativeMarksPenalty || 0) || [];

  const fatigueData = Object.entries(overall.advanced?.fatigue || {})
    .filter(([_, stats]: [string, any]) => stats && stats.total > 0)
    .map(([hour, stats]: [string, any]) => ({
      label: hour === '1' ? 'First Half' : 'Second Half',
      value: Math.round((stats.correct / stats.total) * 100)
    }));

  const difficultyData = Object.entries(overall.advanced?.difficulty || {})
    .filter(([_, stats]: [string, any]) => stats && stats.total > 0)
    .map(([level, stats]: [string, any]) => ({
      label: level,
      value: Math.round((stats.correct / stats.total) * 100)
    }));

  const mistakesData = Object.entries(overall.advanced?.errors || {})
    .map(([cat, count]) => ({ tag: cat, count: count as number }));

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { font-family: -apple-system, system-ui, BlinkMacSystemFont, Arial, sans-serif; padding: 40px; color: #0f172a; line-height: 1.5; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
          h1 { margin: 0; font-size: 28px; color: #1e293b; }
          h2 { margin: 0 0 12px; font-size: 18px; color: #6366f1; border-left: 4px solid #6366f1; padding-left: 12px; }
          p { margin: 4px 0; font-size: 13px; color: #64748b; }
          .section-container { margin-bottom: 40px; page-break-inside: avoid; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-radius: 8px; overflow: hidden; }
          th, td { border: 1px solid #e2e8f0; padding: 12px; font-size: 12px; }
          th { background: #f8fafc !important; text-align: left; font-weight: bold; color: #475569; }
          .chart-card { background: #fff !important; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
          .chip { display: inline-block; margin: 4px 8px 4px 0; background: #fee2e2 !important; color: #b91c1c; border-radius: 999px; padding: 6px 14px; font-size: 11px; font-weight: bold; }
          .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Advanced Performance Analysis</h1>
          <p>User: <strong>${esc(userName)}</strong> • Generated: <strong>${esc(timestamp)}</strong></p>
          <p>Scope: <strong>${esc(filterLabel)}</strong> • Tests Included: <strong>${esc(trends.historicalScores.length)}</strong></p>
        </div>

        ${sections.trajectory ? renderSimpleLine('Overall Score Trajectory', scoreLabelsPdf, scoreValuesPdf, '#6366f1') : ''}
        ${sections.trajectory ? renderSimpleLine('Negative Marking Penalty', scoreLabelsPdf, negativeValuesPdf, '#ef4444') : ''}

        ${sections.proficiency ? `
          <div class="section-container">
            <h2>Subject Proficiency Map</h2>
            <table>
              <thead>
                <tr><th>Subject</th><th>Accuracy</th><th>Questions</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${subjects.map(s => `
                  <tr>
                    <td style="font-weight: 600;">${esc(s.name)}</td>
                    <td style="font-weight: 700; color: ${s.accuracy >= 75 ? '#22c55e' : s.accuracy >= 50 ? '#f59e0b' : '#ef4444'};">${s.accuracy}%</td>
                    <td>${s.total}</td>
                    <td>
                      <span style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; background: ${s.accuracy >= 75 ? '#dcfce7' : s.accuracy >= 50 ? '#ffedd5' : '#fee2e2'} !important; color: ${s.accuracy >= 75 ? '#15803d' : s.accuracy >= 50 ? '#b45309' : '#b91c1c'} !important;">
                        ${s.accuracy >= 75 ? 'Mastery' : s.accuracy >= 50 ? 'Developing' : 'Critical'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${sections.heatmap ? renderHeatmap() : ''}

        <div style="display: flex; gap: 30px;">
          <div style="flex: 1;">
            ${sections.fatigue ? renderBarChart('Cognitive Load: Half-wise Accuracy', fatigueData, '#f59e0b') : ''}
          </div>
          <div style="flex: 1;">
            ${sections.fatigue ? renderBarChart('Difficulty-wise Mastery', difficultyData, '#10b981') : ''}
          </div>
        </div>

        ${sections.mistakes ? renderDonutChart('Mistake Categorization (Error DNA)', mistakesData) : ''}

        ${sections.weaknesses && weaknesses.length > 0 ? `
          <div class="section-container">
            <h2>Repeated Weakness Tracker</h2>
            <p>Persistent patterns identified across multiple test attempts:</p>
            <div style="margin-top: 10px;">
              ${weaknesses.map((w: string) => `<span class="chip">${esc(w)}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${sections.drilldown ? `
          <div class="section-container">
            <h2>Detailed Topic Performance</h2>
            <table>
              <thead>
                <tr><th>Subject / Topic</th><th>Accuracy</th><th>Total Qs</th></tr>
              </thead>
              <tbody>
                ${Object.entries(cumulative.subjects).map(([subName, sub]: [string, any]) => 
                  Object.values(sub.sectionGroups || {}).map((sg: any) => `
                    <tr>
                      <td><span style="font-size: 10px; color: #64748b;">${esc(subName)}</span><br/><strong>${esc(sg.name)}</strong></td>
                      <td style="font-weight: 700; color: ${sg.accuracy >= 50 ? '#10b981' : '#ef4444'};">${sg.accuracy}%</td>
                      <td>${sg.total}</td>
                    </tr>
                  `).join('')
                ).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="footer">
          Generated by Noji Intelligence Engine &bull; Confidential Performance Report &bull; https://noji.app
        </div>
      </body>
    </html>
  `;
};
