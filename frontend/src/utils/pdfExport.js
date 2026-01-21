import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDate, calculateTimeInStage } from './dateHelpers';

/**
 * Export mail list to PDF
 * @param {Array} mails - Array of mail records
 * @param {Object} filters - Current filters applied
 */
export const exportMailListToPDF = (mails, filters = {}) => {
  const doc = new jsPDF('landscape');

  // Add title
  doc.setFontSize(16);
  doc.text('Mail Tracker Report', 14, 20);

  // Add date
  doc.setFontSize(10);
  doc.text(`Generated on: ${formatDate(new Date(), 'dd-MM-yyyy HH:mm')}`, 14, 28);

  // Add filters info if any
  let yPos = 34;
  if (filters.status) {
    doc.text(`Filtered by Status: ${filters.status}`, 14, yPos);
    yPos += 6;
  }
  if (filters.search) {
    doc.text(`Search: ${filters.search}`, 14, yPos);
    yPos += 6;
  }

  // Prepare table data
  const tableData = mails.map((mail) => [
    mail.sl_no || '',
    mail.letter_no || '',
    (mail.mail_reference_subject || '').substring(0, 40) + (mail.mail_reference_subject?.length > 40 ? '...' : ''),
    mail.from_office || '',
    mail.assigned_to?.full_name || 'N/A',
    mail.current_handler?.full_name || 'N/A',
    formatDate(mail.due_date),
    mail.status || '',
    calculateTimeInStage(mail.last_status_change, mail.date_of_completion),
    mail.date_of_completion ? formatDate(mail.date_of_completion) : '-',
  ]);

  // Add table
  autoTable(doc, {
    startY: yPos + 6,
    head: [
      [
        'SL No',
        'Letter No',
        'Subject',
        'From Office',
        'Assigned To',
        'Current Handler',
        'Due Date',
        'Status',
        'Time in Stage',
        'Completion Date',
      ],
    ],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [25, 118, 210],
      textColor: 255,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 20 }, // SL No
      1: { cellWidth: 25 }, // Letter No
      2: { cellWidth: 45 }, // Subject
      3: { cellWidth: 30 }, // From Office
      4: { cellWidth: 30 }, // Assigned To
      5: { cellWidth: 30 }, // Current Handler
      6: { cellWidth: 25 }, // Due Date
      7: { cellWidth: 22 }, // Status
      8: { cellWidth: 25 }, // Time in Stage
      9: { cellWidth: 25 }, // Completion Date
    },
    didParseCell: function (data) {
      // Highlight overdue rows
      if (data.section === 'body') {
        const mail = mails[data.row.index];
        if (mail && mail.status !== 'Closed' && new Date(mail.due_date) < new Date()) {
          data.cell.styles.fillColor = [255, 205, 210]; // Light red
        }
      }
    },
  });

  // Add footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  // Save PDF
  const fileName = `Mail_Tracker_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
