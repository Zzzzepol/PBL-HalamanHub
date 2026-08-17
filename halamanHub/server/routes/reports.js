const express = require('express');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const { requireAuth } = require('../middleware/auth');
const { buildReportData } = require('../utils/reportBuilders');

const router = express.Router();

router.use(requireAuth);

/*
|--------------------------------------------------------------------------
| Report colors
|--------------------------------------------------------------------------
*/

const COLORS = {
  primary: '#166534',
  primaryLight: '#DCFCE7',
  dark: '#1F2937',
  muted: '#6B7280',
  border: '#D1D5DB',
  rowAlt: '#F8FAFC',
  white: '#FFFFFF',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
};

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function formatNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '';
  }

  if (typeof value === 'number') {
    return value.toLocaleString('en-PH', {
      maximumFractionDigits: 2,
    });
  }

  return String(value);
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function safeFilename(value) {
  const filename = String(value || 'report')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  return filename || 'report';
}

/*
|--------------------------------------------------------------------------
| Excel column letter helper
|
| A, B, C ... Z, AA, AB ...
|--------------------------------------------------------------------------
*/

function getExcelColumnLetter(columnNumber) {
  let result = '';
  let number = columnNumber;

  while (number > 0) {
    const remainder = (number - 1) % 26;

    result =
      String.fromCharCode(65 + remainder) +
      result;

    number = Math.floor(
      (number - 1) / 26
    );
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| Get Excel column widths
|--------------------------------------------------------------------------
*/

function getColumnWidths(columns, rows) {
  return columns.map((column, index) => {
    const values = rows
      .slice(0, 200)
      .map((row) => {
        const value = row[index];

        if (
          value === null ||
          value === undefined
        ) {
          return '';
        }

        return String(value);
      });

    const maxLength = Math.max(
      String(column).length,
      ...values.map((value) => value.length),
      1
    );

    const columnName = String(column);

    if (/date|time/i.test(columnName)) {
      return 23;
    }

    if (
      /customer|reason|product|description|remarks|comment/i.test(
        columnName
      )
    ) {
      return Math.min(
        Math.max(maxLength + 2, 18),
        35
      );
    }

    return Math.min(
      Math.max(maxLength + 2, 12),
      24
    );
  });
}

/*
|--------------------------------------------------------------------------
| CSV
|--------------------------------------------------------------------------
*/

function sendCsv(
  res,
  filenameBase,
  columns,
  rows
) {
  function escapeCsv(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    return `"${String(value)
      .replace(/"/g, '""')
      .replace(/\r?\n/g, ' ')}"`;
  }

  const lines = [];

  lines.push(
    columns
      .map(escapeCsv)
      .join(',')
  );

  rows.forEach((row) => {
    const normalizedRow = columns.map(
      (_, index) => row[index]
    );

    lines.push(
      normalizedRow
        .map(escapeCsv)
        .join(',')
    );
  });

  res.setHeader(
    'Content-Type',
    'text/csv; charset=utf-8'
  );

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filenameBase}.csv"`
  );

  return res.send(
    `\uFEFF${lines.join('\n')}`
  );
}

/*
|--------------------------------------------------------------------------
| Excel
|--------------------------------------------------------------------------
*/

async function sendExcel(
  res,
  filenameBase,
  columns,
  rows,
  metadata
) {
  const workbook =
    new ExcelJS.Workbook();

  workbook.creator = 'HalamanHub';
  workbook.created = new Date();
  workbook.modified = new Date();

  workbook.properties = {
    title:
      metadata.title ||
      'HalamanHub Farm Report',

    subject:
      metadata.reportType ||
      'Farm Report',

    company: 'HalamanHub',
  };

  /*
   * Create worksheet
   */

  const sheet =
    workbook.addWorksheet(
      'Report',
      {
        views: [
          {
            state: 'frozen',
            ySplit: 7,
          },
        ],
      }
    );

  /*
   * Page setup
   */

  sheet.pageSetup = {
    orientation:
      columns.length > 7
        ? 'landscape'
        : 'portrait',

    paperSize: 9,

    fitToPage: true,

    fitToWidth: 1,

    fitToHeight: 0,
  };

  sheet.pageMargins = {
    left: 0.35,
    right: 0.35,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };

  /*
   * Make sure we always have
   * at least one column.
   */

  const columnCount =
    Math.max(columns.length, 1);

  /*
   * Title
   */

  sheet.mergeCells(
    1,
    1,
    1,
    columnCount
  );

  const titleCell =
    sheet.getCell(1, 1);

  titleCell.value =
    metadata.title ||
    'HalamanHub Farm Report';

  titleCell.font = {
    name: 'Aptos',
    size: 18,
    bold: true,
    color: {
      argb: '166534',
    },
  };

  titleCell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
  };

  sheet.getRow(1).height = 28;

  /*
   * Report type
   */

  sheet.mergeCells(
    2,
    1,
    2,
    columnCount
  );

  const typeCell =
    sheet.getCell(2, 1);

  typeCell.value =
    metadata.reportType ||
    'Farm Report';

  typeCell.font = {
    name: 'Aptos',
    size: 11,
    bold: true,
    color: {
      argb: '374151',
    },
  };

  sheet.getRow(2).height = 20;

  /*
   * Reporting period
   */

  sheet.mergeCells(
    3,
    1,
    3,
    columnCount
  );

  const periodCell =
    sheet.getCell(3, 1);

  periodCell.value =
    `Reporting period: ${
      metadata.period || 'All available data'
    }`;

  periodCell.font = {
    name: 'Aptos',
    size: 10,
    color: {
      argb: '6B7280',
    },
  };

  /*
   * Generated time
   */

  sheet.mergeCells(
    4,
    1,
    4,
    columnCount
  );

  const generatedCell =
    sheet.getCell(4, 1);

  generatedCell.value =
    `Generated: ${formatDateTime(
      metadata.generatedAt
    )}`;

  generatedCell.font = {
    name: 'Aptos',
    size: 9,
    italic: true,
    color: {
      argb: '6B7280',
    },
  };

  /*
   * Summary
   */

  sheet.mergeCells(
    5,
    1,
    5,
    columnCount
  );

  const summaryCell =
    sheet.getCell(5, 1);

  const rowCount =
    Number(metadata.rowCount) || 0;

  summaryCell.value =
    `Total records: ${rowCount.toLocaleString(
      'en-PH'
    )}`;

  summaryCell.font = {
    name: 'Aptos',
    size: 10,
    bold: true,
    color: {
      argb: '166534',
    },
  };

  /*
   * Spacer
   */

  sheet.getRow(6).height = 8;

  /*
   * Table header
   */

  const headerRow =
    sheet.getRow(7);

  columns.forEach(
    (column, index) => {
      const cell =
        headerRow.getCell(
          index + 1
        );

      cell.value =
        String(column);

      cell.font = {
        name: 'Aptos',
        size: 10,
        bold: true,
        color: {
          argb: 'FFFFFF',
        },
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: '166534',
        },
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true,
      };

      cell.border = {
        top: {
          style: 'thin',
          color: {
            argb: '14532D',
          },
        },

        bottom: {
          style: 'thin',
          color: {
            argb: '14532D',
          },
        },

        left: {
          style: 'thin',
          color: {
            argb: '14532D',
          },
        },

        right: {
          style: 'thin',
          color: {
            argb: '14532D',
          },
        },
      };
    }
  );

  headerRow.height = 32;

  /*
   * Data rows
   */

  rows.forEach(
    (row, rowIndex) => {
      const normalizedRow =
        columns.map(
          (_, index) =>
            row[index]
        );

      const excelRow =
        sheet.addRow(
          normalizedRow
        );

      const isAlternate =
        rowIndex % 2 === 1;

      excelRow.height = 21;

      normalizedRow.forEach(
        (value, columnIndex) => {
          const cell =
            excelRow.getCell(
              columnIndex + 1
            );

          const column =
            String(
              columns[
                columnIndex
              ] || ''
            );

          /*
           * Numbers
           */

          if (
            typeof value ===
            'number'
          ) {
            cell.value = value;

            cell.numFmt =
              '#,##0.00';
          }

          /*
           * Dates
           */

          else if (
            /date|time/i.test(
              column
            ) &&
            value
          ) {
            const date =
              new Date(value);

            if (
              !Number.isNaN(
                date.getTime()
              )
            ) {
              cell.value = date;

              cell.numFmt =
                'mmm dd, yyyy hh:mm';
            } else {
              cell.value =
                String(value);
            }
          }

          /*
           * Everything else
           */

          else {
            cell.value =
              value === null ||
              value === undefined
                ? ''
                : value;
          }

          cell.font = {
            name: 'Aptos',
            size: 9,
            color: {
              argb: '1F2937',
            },
          };

          cell.alignment = {
            vertical: 'middle',

            horizontal:
              typeof value ===
              'number'
                ? 'right'
                : 'left',

            wrapText:
              typeof value !==
              'number',
          };

          cell.border = {
            bottom: {
              style: 'hair',
              color: {
                argb: 'E5E7EB',
              },
            },
          };

          if (isAlternate) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: {
                argb: 'F8FAFC',
              },
            };
          }
        }
      );
    }
  );

  /*
   * Auto filter
   */

  if (columns.length > 0) {
    sheet.autoFilter = {
      from: {
        row: 7,
        column: 1,
      },

      to: {
        row:
          7 + rows.length,

        column:
          columns.length,
      },
    };
  }

  /*
   * Column widths
   */

  const widths =
    getColumnWidths(
      columns,
      rows
    );

  widths.forEach(
    (width, index) => {
      sheet.getColumn(
        index + 1
      ).width = width;
    }
  );

  /*
   * Footer
   */

  sheet.headerFooter.oddFooter =
    '&LHalamanHub&CPage &P of &N&RGenerated report';

  /*
   * Repeat header
   */

  sheet.pageSetup.printTitlesRow =
    '7:7';

  /*
   * FIX:
   * Proper Excel column conversion.
   *
   * The old code used String.fromCharCode(),
   * which breaks after column Z.
   */

  if (columns.length > 0) {
    const lastColumn =
      getExcelColumnLetter(
        columns.length
      );

    sheet.pageSetup.printArea =
      `A1:${lastColumn}${
        7 + rows.length
      }`;
  }

  /*
   * Note
   */

  const noteRow =
    8 + rows.length;

  sheet.mergeCells(
    noteRow,
    1,
    noteRow,
    columnCount
  );

  const noteCell =
    sheet.getCell(
      noteRow,
      1
    );

  noteCell.value =
    'Generated from HalamanHub live application data.';

  noteCell.font = {
    name: 'Aptos',
    size: 8,
    italic: true,
    color: {
      argb: '6B7280',
    },
  };

  /*
   * Send Excel file
   */

  await workbook.xlsx.write(
    res
  );

  return res.end();
}

/*
|--------------------------------------------------------------------------
| PDF
|--------------------------------------------------------------------------
*/

function sendPdf(
  res,
  filenameBase,
  columns,
  rows,
  metadata
) {
  const orientation =
    columns.length > 6
      ? 'landscape'
      : 'portrait';

  const doc =
    new PDFDocument({
      size: 'A4',

      layout: orientation,

      margins: {
        top: 45,
        bottom: 45,
        left: 40,
        right: 40,
      },

      bufferPages: true,

      info: {
        Title:
          metadata.title ||
          'HalamanHub Farm Report',

        Author: 'HalamanHub',

        Subject:
          metadata.reportType ||
          'Farm Report',
      },
    });

  res.setHeader(
    'Content-Type',
    'application/pdf'
  );

  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filenameBase}.pdf"`
  );

  doc.pipe(res);

  const pageWidth =
    doc.page.width;

  const pageHeight =
    doc.page.height;

  const left =
    doc.page.margins.left;

  const right =
    doc.page.margins.right;

  const usableWidth =
    pageWidth -
    left -
    right;

  /*
   * Header
   */

  function drawReportHeader() {
    doc
      .fillColor(
        COLORS.primary
      )
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(
        metadata.title ||
          'HalamanHub Farm Report',
        left,
        38,
        {
          width:
            usableWidth,
        }
      );

    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor(
        COLORS.dark
      )
      .text(
        metadata.reportType ||
          'Farm Report',
        left,
        67,
        {
          width:
            usableWidth,
        }
      );

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor(
        COLORS.muted
      )
      .text(
        `Reporting period: ${
          metadata.period ||
          'All available data'
        }`,
        left,
        84,
        {
          width:
            usableWidth * 0.65,
        }
      );

    doc
      .fontSize(8)
      .text(
        `Generated: ${formatDateTime(
          metadata.generatedAt
        )}`,
        left +
          usableWidth * 0.55,
        84,
        {
          width:
            usableWidth * 0.45,
          align: 'right',
        }
      );

    doc
      .moveTo(
        left,
        102
      )
      .lineTo(
        left + usableWidth,
        102
      )
      .lineWidth(1)
      .strokeColor(
        COLORS.border
      )
      .stroke();

    const total =
      Number(metadata.rowCount) ||
      0;

    doc
      .fontSize(8)
      .fillColor(
        COLORS.muted
      )
      .text(
        `${total.toLocaleString(
          'en-PH'
        )} record(s)`,
        left,
        110
      );

    return 128;
  }

  /*
   * PDF column widths
   */

  function getPdfColumnWidths() {
    if (!columns.length) {
      return [];
    }

    const weights =
      columns.map(
        (column) => {
          const name =
            String(column);

          if (
            /date|time/i.test(
              name
            )
          ) {
            return 1.8;
          }

          if (
            /customer|reason|description|remarks|comment|product/i.test(
              name
            )
          ) {
            return 1.5;
          }

          if (
            /amount|moisture|temp|temperature|humidity|fill|level|ec|ph|nitrogen|phosphorus|potassium/i.test(
              name
            )
          ) {
            return 1;
          }

          return 1.15;
        }
      );

    const totalWeight =
      weights.reduce(
        (sum, weight) =>
          sum + weight,
        0
      );

    return weights.map(
      (weight) =>
        usableWidth *
        (weight /
          totalWeight)
    );
  }

  const columnWidths =
    getPdfColumnWidths();

  const rowHeight = 25;
  const headerHeight = 30;

  /*
   * Table header
   */

  function drawTableHeader(y) {
    let x = left;

    doc
      .fillColor(
        COLORS.primary
      )
      .rect(
        left,
        y,
        usableWidth,
        headerHeight
      )
      .fill();

    columns.forEach(
      (column, index) => {
        const width =
          columnWidths[index];

        doc
          .fillColor(
            COLORS.white
          )
          .fontSize(8)
          .font(
            'Helvetica-Bold'
          )
          .text(
            String(column),
            x + 4,
            y + 8,
            {
              width:
                Math.max(
                  width - 8,
                  1
                ),

              height:
                headerHeight - 10,

              align:
                'center',

              lineGap: 0,

              ellipsis: true,
            }
          );

        x += width;
      }
    );

    return (
      y + headerHeight
    );
  }

  /*
   * Table row
   */

  function drawRow(
    row,
    rowIndex,
    y
  ) {
    if (
      rowIndex % 2 ===
      1
    ) {
      doc
        .fillColor(
          COLORS.rowAlt
        )
        .rect(
          left,
          y,
          usableWidth,
          rowHeight
        )
        .fill();
    }

    let x = left;

    columns.forEach(
      (column, index) => {
        const value =
          row[index];

        const width =
          columnWidths[index];

        const columnName =
          String(column);

        let displayValue;

        if (
          value === null ||
          value === undefined ||
          value === ''
        ) {
          displayValue = '—';
        } else if (
          typeof value ===
          'number'
        ) {
          displayValue =
            formatNumber(value);
        } else if (
          /date|time/i.test(
            columnName
          )
        ) {
          displayValue =
            formatDateTime(value);
        } else {
          displayValue =
            String(value);
        }

        doc
          .fillColor(
            COLORS.dark
          )
          .fontSize(7.5)
          .font(
            'Helvetica'
          )
          .text(
            displayValue,
            x + 4,
            y + 8,
            {
              width:
                Math.max(
                  width - 8,
                  1
                ),

              height:
                rowHeight - 8,

              align:
                typeof value ===
                'number'
                  ? 'right'
                  : 'left',

              ellipsis: true,

              lineGap: 0,
            }
          );

        /*
         * Vertical separator
         */

        doc
          .moveTo(
            x + width,
            y
          )
          .lineTo(
            x + width,
            y + rowHeight
          )
          .lineWidth(0.25)
          .strokeColor(
            COLORS.border
          )
          .stroke();

        x += width;
      }
    );

    /*
     * Bottom border
     */

    doc
      .moveTo(
        left,
        y + rowHeight
      )
      .lineTo(
        left + usableWidth,
        y + rowHeight
      )
      .lineWidth(0.25)
      .strokeColor(
        COLORS.border
      )
      .stroke();

    return (
      y + rowHeight
    );
  }

  /*
   * Start report
   */

  let y =
    drawReportHeader();

  /*
   * Summary box
   */

  const total =
    Number(metadata.rowCount) ||
    0;

  doc
    .roundedRect(
      left,
      y,
      usableWidth,
      34,
      4
    )
    .fillColor(
      COLORS.primaryLight
    )
    .fill();

  doc
    .fillColor(
      COLORS.primary
    )
    .fontSize(9)
    .font('Helvetica-Bold')
    .text(
      'Report summary',
      left + 10,
      y + 8
    );

  doc
    .fillColor(
      COLORS.dark
    )
    .fontSize(8)
    .font('Helvetica')
    .text(
      `${total.toLocaleString(
        'en-PH'
      )} records included in this report.`,
      left + 10,
      y + 20
    );

  y += 48;

  /*
   * No columns
   */

  if (!columns.length) {
    doc
      .fontSize(10)
      .fillColor(
        COLORS.muted
      )
      .text(
        'No report data is available for the selected filters.',
        left,
        y
      );

    finishPdf(
      doc,
      pageHeight,
      left,
      usableWidth
    );

    return;
  }

  /*
   * Table
   */

  y =
    drawTableHeader(y);

  /*
   * Keep PDF manageable.
   *
   * Excel and CSV still contain
   * the complete dataset.
   */

  const pdfRowLimit = 1000;

  const rowsToRender =
    rows.slice(
      0,
      pdfRowLimit
    );

  rowsToRender.forEach(
    (row, rowIndex) => {
      const bottomMargin =
        doc.page.margins.bottom;

      if (
        y + rowHeight >
        pageHeight -
          bottomMargin -
          25
      ) {
        doc.addPage();

        y =
          drawReportHeader();

        y =
          drawTableHeader(y);
      }

      y = drawRow(
        row,
        rowIndex,
        y
      );
    }
  );

  /*
   * PDF limit warning
   */

  if (
    rows.length >
    pdfRowLimit
  ) {
    if (
      y + 55 >
      pageHeight -
        doc.page.margins
          .bottom
    ) {
      doc.addPage();

      y =
        drawReportHeader();
    }

    doc
      .roundedRect(
        left,
        y + 10,
        usableWidth,
        38,
        4
      )
      .fillColor(
        COLORS.warningBg
      )
      .fill();

    doc
      .fillColor(
        COLORS.warningText
      )
      .fontSize(8)
      .font('Helvetica')
      .text(
        `PDF displays the first ${pdfRowLimit.toLocaleString(
          'en-PH'
        )} of ${rows.length.toLocaleString(
          'en-PH'
        )} records. Export Excel or CSV for the complete dataset.`,
        left + 10,
        y + 21,
        {
          width:
            usableWidth - 20,
        }
      );
  }

  /*
   * Finish PDF
   */

  finishPdf(
    doc,
    pageHeight,
    left,
    usableWidth
  );
}

/*
|--------------------------------------------------------------------------
| PDF footer
|--------------------------------------------------------------------------
*/

function finishPdf(
  doc,
  pageHeight,
  left,
  usableWidth
) {
  const range =
    doc.bufferedPageRange();

  for (
    let i = range.start;
    i <
    range.start +
      range.count;
    i += 1
  ) {
    doc.switchToPage(i);

    const footerY =
      pageHeight - 25;

    doc
      .fontSize(7)
      .font('Helvetica')
      .fillColor(
        COLORS.muted
      )
      .text(
        'HalamanHub Farm Management',
        left,
        footerY,
        {
          width:
            usableWidth * 0.6,
          align: 'left',
        }
      );

    doc.text(
      `Page ${
        i + 1
      } of ${range.count}`,
      left +
        usableWidth * 0.6,
      footerY,
      {
        width:
          usableWidth * 0.4,
        align: 'right',
      }
    );
  }

  doc.end();
}

/*
|--------------------------------------------------------------------------
| GET /api/reports/generate
|--------------------------------------------------------------------------
|
| Query:
|
| ?dataType=All sensor data
| &format=PDF
| &from=YYYY-MM-DD
| &to=YYYY-MM-DD
|
|--------------------------------------------------------------------------
*/

router.get(
  '/generate',
  async (req, res) => {
    try {
      const {
        dataType = 'All sensor data',
        format = 'PDF',
        from,
        to,
      } = req.query;

      /*
       * Validate dates only.
       *
       * IMPORTANT:
       * We do NOT touch MongoDB here.
       */

      if (from && to) {
        const fromDate =
          new Date(
            `${from}T00:00:00`
          );

        const toDate =
          new Date(
            `${to}T23:59:59`
          );

        if (
          Number.isNaN(
            fromDate.getTime()
          ) ||
          Number.isNaN(
            toDate.getTime()
          )
        ) {
          return res
            .status(400)
            .json({
              message:
                'Invalid date format. Use YYYY-MM-DD.',
            });
        }

        if (
          fromDate > toDate
        ) {
          return res
            .status(400)
            .json({
              message:
                'The from date cannot be later than the to date.',
            });
        }
      }

      /*
       * IMPORTANT:
       *
       * This is the ONLY place where
       * your existing report builder
       * is called.
       *
       * MongoDB logic stays inside
       * reportBuilders.js.
       */

      const report =
        await buildReportData(
          dataType,
          from,
          to
        );

      /*
       * Protect against malformed
       * report builder results.
       */

      const columns =
        Array.isArray(
          report?.columns
        )
          ? report.columns
          : [];

      const rows =
        Array.isArray(
          report?.rows
        )
          ? report.rows
          : [];

      const metadata =
        report?.metadata || {};

      /*
       * Normalize metadata so
       * exports don't crash when
       * a field is missing.
       */

      const normalizedMetadata = {
        title:
          metadata.title ||
          'HalamanHub Farm Report',

        reportType:
          metadata.reportType ||
          String(dataType),

        period:
          metadata.period ||
          (
            from && to
              ? `${from} to ${to}`
              : 'All available data'
          ),

        generatedAt:
          metadata.generatedAt ||
          new Date(),

        rowCount:
          Number(
            metadata.rowCount
          ) ||
          rows.length,
      };

      /*
       * Filename
       */

      const safeName =
        safeFilename(
          dataType
        );

      const rangeLabel =
        from && to
          ? `${from}_to_${to}`
          : 'last-30-days';

      const filenameBase =
        `${safeName}_${rangeLabel}`;

      /*
       * Normalize format
       */

      const selectedFormat =
        String(format)
          .trim()
          .toLowerCase();

      /*
       * CSV
       */

      if (
        selectedFormat ===
        'csv'
      ) {
        return sendCsv(
          res,
          filenameBase,
          columns,
          rows
        );
      }

      /*
       * Excel
       */

      if (
        selectedFormat ===
          'excel' ||
        selectedFormat ===
          'excel (.xlsx)' ||
        selectedFormat ===
          'xlsx'
      ) {
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );

        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filenameBase}.xlsx"`
        );

        return await sendExcel(
          res,
          filenameBase,
          columns,
          rows,
          normalizedMetadata
        );
      }

      /*
       * PDF
       */

      return sendPdf(
        res,
        filenameBase,
        columns,
        rows,
        normalizedMetadata
      );
    } catch (err) {
      console.error(
        'Report generation error:',
        err
      );

      /*
       * If response has not started,
       * return a useful JSON error.
       */

      if (!res.headersSent) {
        return res
          .status(500)
          .json({
            message:
              err?.message ||
              'Failed to generate report.',

            /*
             * Useful during development.
             * Remove stack in production if desired.
             */
            ...(process.env.NODE_ENV !==
              'production' && {
              error: err?.stack,
            }),
          });
      }

      /*
       * Response already started.
       */

      return res.end();
    }
  }
);

module.exports = router;