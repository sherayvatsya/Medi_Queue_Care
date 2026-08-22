import { jsPDF } from 'jspdf';
import { Patient } from '../types';

export const exportTokenToPDF = (
  patient: Patient,
  doctorName: string,
  roomNumber: string,
  onNotify?: (title: string, desc: string, type?: 'info' | 'success' | 'urgent') => void
) => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5', // A5 format (148 x 210 mm) is standard clinical consultation slip format
    });

    // Top Header Banner (Hospital Teal / Sky Blue Gradient Simulation)
    doc.setFillColor(14, 165, 233); // #0ea5e9 Sky Blue
    doc.rect(0, 0, 148, 28, 'F');

    // Hospital Branding
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    const hospitalTitle = (patient.hospitalName || 'Max Super Specialty Hospital, Mohali').toUpperCase();
    doc.text(hospitalTitle.length > 34 ? hospitalTitle.substring(0, 32) + '...' : hospitalTitle, 12, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('OPD TELEMETRY & SMART QUEUE MANAGEMENT SYSTEM', 12, 16);
    doc.setFontSize(7);
    doc.text('ICMR-Accredited Healthcare Facility • Live Queue Pass', 12, 21);

    // Date & Time in top right
    const printDate = new Date().toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    doc.setFontSize(7);
    doc.text(`Generated: ${printDate}`, 136, 10, { align: 'right' });
    doc.text(`UHID: ${patient.uhid}`, 136, 16, { align: 'right' });
    doc.text('DIGITAL PASS (VERIFIED)', 136, 21, { align: 'right' });

    // Main Token Box
    doc.setFillColor(240, 249, 255);
    doc.setDrawColor(186, 230, 253);
    doc.setLineWidth(0.5);
    doc.roundedRect(12, 33, 124, 30, 3, 3, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('OFFICIAL OPD CONSULTATION TOKEN', 74, 39, { align: 'center' });

    // Token Number Display
    doc.setTextColor(14, 165, 233);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text(patient.tokenNumber, 74, 51, { align: 'center' });

    // Queue status subtitle
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const queueText =
      patient.queuePosition === 0
        ? 'STATUS: NEXT IN LINE • PLEASE PROCEED TO ROOM'
        : `QUEUE STATUS: ${patient.queuePosition} PATIENTS AHEAD • EST. WAIT ~${patient.estimatedWaitMinutes} MINS`;
    doc.text(queueText, 74, 58, { align: 'center' });

    // Patient & Encounter Details Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(12, 67, 124, 58, 2, 2, 'FD');

    // Section Title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('CONSULTATION & PATIENT PARTICULARS', 16, 73);

    // Separator line
    doc.setDrawColor(226, 232, 240);
    doc.line(16, 75, 132, 75);

    doc.setFontSize(8);
    const labelX = 16;
    const valueX = 52;
    let currentY = 81;

    const addRow = (label: string, value: string, isHighlight = false, color?: [number, number, number]) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(label, labelX, currentY);

      doc.setFont('helvetica', isHighlight ? 'bold' : 'normal');
      if (color) {
        doc.setTextColor(color[0], color[1], color[2]);
      } else {
        doc.setTextColor(15, 23, 42);
      }
      doc.text(value, valueX, currentY);
      currentY += 5.5;
    };

    addRow('Hospital:', patient.hospitalName || 'Max Super Specialty Hospital, Mohali', true, [14, 165, 233]);
    addRow('Patient Name:', `${patient.name} (${patient.age} yrs / ${patient.gender})`, true);
    addRow('Unique Patient ID:', patient.uhid, true, [2, 132, 199]);
    addRow('Mobile / SMS Phone:', patient.phone);
    addRow('Assigned Doctor:', `${doctorName} (${patient.department})`, true);
    addRow('Destination Suite:', `${roomNumber} (${patient.opdBlock}, ${patient.floor})`, true, [14, 165, 233]);
    
    const symptomsStr = patient.symptoms.slice(0, 3).join(', ') || 'General OPD Evaluation';
    addRow('Presenting Symptoms:', symptomsStr.length > 38 ? symptomsStr.substring(0, 36) + '...' : symptomsStr);
    
    addRow(
      'Documented Allergies:',
      patient.allergiesText || 'None reported',
      !!patient.allergiesText,
      patient.allergiesText ? [220, 38, 38] : undefined
    );
    
    if (patient.wheelchairRequest) {
      addRow(
        'Mobility Assistance:',
        `Porter Requested at ${patient.wheelchairRequest.location}`,
        true,
        [22, 101, 52]
      );
    }

    // Diagnostic Pre-Test Section if opted in
    if (patient.preTestOptIn && patient.preTestRecommended && patient.preTestRecommended.length > 0) {
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(12, 129, 124, 21, 2, 2, 'FD');

      doc.setTextColor(22, 101, 52);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('LABORATORY FAST-TRACK DIAGNOSTICS (ACTIVE)', 16, 135);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const testNames = patient.preTestRecommended.map((t) => t.name).join(', ');
      doc.text(
        `Recommended Tests: ${testNames.length > 48 ? testNames.substring(0, 46) + '...' : testNames}`,
        16,
        140
      );
      doc.text('Lab Location: Ground Floor, Diagnostic Wing Block C (Near Gate 3)', 16, 145);
    }

    // Instructions Box
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('Patient Instructions & Security Verification:', 12, 156);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text('1. Please arrive outside your designated room when your token is within 2 positions.', 12, 161);
    doc.text('2. Present this PDF file on your device or show your SMS notification link at the door.', 12, 166);
    doc.text('3. Live bilingual audio announcements (Hindi / English) will chime upon token activation.', 12, 171);

    // Bottom Barcode & Security Strip
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 180, 148, 30, 'F');

    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`|||||| ||| ||||||| |||| |||||||| |||||||`, 74, 188, { align: 'center' });
    doc.setFontSize(7);
    doc.text(`[VERIFIED-PASS: ${patient.uhid}-${patient.tokenNumber}]`, 74, 193, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Medi-Queue™ Autonomous OPD Telemetry • ${patient.hospitalName || 'Max Super Specialty Hospital, Mohali'}`, 74, 199, { align: 'center' });

    // Save PDF directly into device memory / Downloads folder
    const safeName = patient.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `MediQueue_Token_${patient.tokenNumber}_${safeName}.pdf`;
    doc.save(fileName);

    if (onNotify) {
      onNotify(
        'PDF Saved to Device',
        `Consultation pass "${fileName}" saved in PDF format to your device memory!`,
        'success'
      );
    }
  } catch (error) {
    console.error('Failed to export PDF:', error);
    if (onNotify) {
      onNotify('Export Error', 'Unable to generate PDF directly. Please try printing to PDF.', 'urgent');
    }
  }
};
