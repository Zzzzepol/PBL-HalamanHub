const express = require('express');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { requireAuth } = require('../middleware/auth');
const { buildReportData } = require('../utils/reportBuilders');

const router = express.Router();
router.use(requireAuth);

// GET /api/reports/generate?dataType=...&format=PDF|Excel (.xlsx)|CSV&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/generate', async (req, res) => {
  try {
    const { dataType = 'All sensor data', format = 'PDF', from, to } = req.query;
    const { columns, rows } = await buildReportData(dataType, from, to);

    const safeName = dataType.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    const rangeLabel = from && to ? `${from}_to_${to}` : 'last-30-days';
    const filenameBase = `${safeName}_${rangeLabel}`;

    if (format === 'CSV') {
      const csvLines = [columns.join(',')];
      rows.forEach(row => csvLines.push(row.map(v => `"${v ?? ''}"`).join(',')));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);
      return res.send(csvLines.join('\n'));
    }

    if (format === 'Excel (.xlsx)' || format === 'Excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Report');
      sheet.addRow(columns).font = { bold: true };
      rows.forEach(row => sheet.addRow(row));
      sheet.columns.forEach(col => { col.width = 20; });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.xlsx"`);
      await workbook.xlsx.write(res);
      return res.end();
    }

    // Default: PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.pdf"`);
    doc.pipe(res);

    doc.fontSize(18).text('HalamanHub Farm Report', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).fillColor('#666').text(dataType, { align: 'center' });
    doc.fontSize(9).text(from && to ? `${from} to ${to}` : 'Last 30 days', { align: 'center' });
    doc.moveDown(1);
    doc.fillColor('#000');

    const colWidth = (doc.page.width - 80) / columns.length;
    let y = doc.y;

    doc.fontSize(9).font('Helvetica-Bold');
    columns.forEach((col, i) => doc.text(String(col), 40 + i * colWidth, y, { width: colWidth }));
    doc.moveDown(0.5);
    doc.font('Helvetica');

    rows.slice(0, 400).forEach(row => { // cap so a huge range doesn't produce a 1000-page PDF
      y = doc.y;
      if (y > doc.page.height - 60) { doc.addPage(); y = doc.y; }
      row.forEach((cell, i) => doc.text(cell != null ? String(cell) : '—', 40 + i * colWidth, y, { width: colWidth }));
      doc.moveDown(0.4);
    });

    if (rows.length > 400) {
      doc.moveDown(1).fontSize(9).fillColor('#888').text(
        `Showing first 400 of ${rows.length} rows. Use Excel or CSV export for the full dataset.`,
        { align: 'center' }
      );
    }

    doc.end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;