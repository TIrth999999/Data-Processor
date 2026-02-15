import React, { useState } from 'react';
import { Download, Plus, Upload, Save, Trash2, Database, ArrowLeft, Calendar, FileSpreadsheet, FileText, LogOut } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { clsx } from 'clsx';
import Papa from 'papaparse';
import { parseFile, isSupportedFileFormat } from '../utils/fileParser';

const EnrichmentPanel = ({ data, onUpdateData, onBack, onLogout }) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthAliasMap = {
        jan: 'Jan', january: 'Jan', '1': 'Jan', '01': 'Jan',
        feb: 'Feb', february: 'Feb', '2': 'Feb', '02': 'Feb',
        mar: 'Mar', march: 'Mar', '3': 'Mar', '03': 'Mar',
        apr: 'Apr', april: 'Apr', '4': 'Apr', '04': 'Apr',
        may: 'May', '5': 'May', '05': 'May',
        jun: 'Jun', june: 'Jun', '6': 'Jun', '06': 'Jun',
        jul: 'Jul', july: 'Jul', '7': 'Jul', '07': 'Jul',
        aug: 'Aug', august: 'Aug', '8': 'Aug', '08': 'Aug',
        sep: 'Sep', sept: 'Sep', september: 'Sep', '9': 'Sep', '09': 'Sep',
        oct: 'Oct', october: 'Oct', '10': 'Oct',
        nov: 'Nov', november: 'Nov', '11': 'Nov',
        dec: 'Dec', december: 'Dec', '12': 'Dec',
    };

    // State definitions
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldValue, setNewFieldValue] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAttModal, setShowAttModal] = useState(false);
    const [attMode, setAttMode] = useState('manual'); // 'manual' | 'csv'
    const [selectedMonth, setSelectedMonth] = useState('Jan');
    const [searchQuery, setSearchQuery] = useState('');
    const [bulkTotalDays, setBulkTotalDays] = useState('');

    const [attMonth, setAttMonth] = useState('');
    const [attTotalDays, setAttTotalDays] = useState('');
    const [attAttended, setAttAttended] = useState('');

    // Inline editing state
    const [editingCell, setEditingCell] = useState(null); // { id, key }
    const [editValue, setEditValue] = useState('');

    const calculateStipend = (total, attended) => {
        const t = Number(total);
        const a = Number(attended);

        if (isNaN(t) || isNaN(a) || t === 0) {
            return {
                percent: '0.0%',
                stipend: '0'
            };
        }

        const pct = (a / t) * 100;
        return {
            percent: pct.toFixed(1) + '%',
            stipend: pct > 60 ? '2000' : '0'
        };
    };

    const toAmount = (value) => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const normalized = String(value ?? '').replace(/,/g, '').trim();
        const num = Number(normalized);
        return Number.isFinite(num) ? num : 0;
    };

    const normalizeMonth = (value) => {
        const token = String(value ?? '').trim().toLowerCase().replace(/\./g, '');
        return monthAliasMap[token] || null;
    };

    const parseMonthMetricKey = (key) => {
        const match = String(key ?? '').trim().match(/^(.+?)\s*(Total|Attended|Stipend|%)$/i);
        if (!match) return null;
        const month = normalizeMonth(match[1]);
        if (!month) return null;
        return { month, metric: match[2].toLowerCase() };
    };

    const resolveMonthKeys = (rows, month) => {
        let attendanceKey = `${month} %`;
        let stipendKey = `${month} Stipend`;
        const allKeys = new Set();

        rows.forEach((row) => {
            Object.keys(row || {}).forEach((k) => allKeys.add(k));
        });

        if (!allKeys.has(attendanceKey) || !allKeys.has(stipendKey)) {
            allKeys.forEach((key) => {
                const parsed = parseMonthMetricKey(key);
                if (!parsed || parsed.month !== month) return;
                if (parsed.metric === '%') attendanceKey = key;
                if (parsed.metric === 'stipend') stipendKey = key;
            });
        }

        return { attendanceKey, stipendKey };
    };

    const resolveMonthAttendanceKeys = (rows, month) => {
        let totalKey = `${month} Total`;
        let attendedKey = `${month} Attended`;
        const allKeys = new Set();

        rows.forEach((row) => {
            Object.keys(row || {}).forEach((k) => allKeys.add(k));
        });

        if (!allKeys.has(totalKey) || !allKeys.has(attendedKey)) {
            allKeys.forEach((key) => {
                const parsed = parseMonthMetricKey(key);
                if (!parsed || parsed.month !== month) return;
                if (parsed.metric === 'total') totalKey = key;
                if (parsed.metric === 'attended') attendedKey = key;
            });
        }

        return { totalKey, attendedKey };
    };

    const handleSave = (id, key, value) => {
        const newData = data.map(row => {
            if (row.id === id) {
                const updatedRow = { ...row, [key]: value };

                // Auto-recalculate if editing attendance fields
                if (key.includes('Total') || key.includes('Attended')) {
                    // Extract month from key e.g. "Jan Total" -> "Jan"
                    const m = key.split(' ')[0];
                    if (months.includes(m)) {
                        const totalKey = `${m} Total`;
                        const attendedKey = `${m} Attended`;

                        // Get latest values (one is being updated right now)
                        const t = key === totalKey ? value : updatedRow[totalKey];
                        const a = key === attendedKey ? value : updatedRow[attendedKey];

                        if (t && a) {
                            const { percent, stipend } = calculateStipend(t, a);
                            updatedRow[`${m} %`] = percent;
                            updatedRow[`${m} Stipend`] = stipend;
                        }
                    }
                }

                if (updatedRow.originalRow) {
                    updatedRow.originalRow = { ...updatedRow.originalRow, [key]: value };
                    // Propagate calculated fields too
                    if (key.includes('Total') || key.includes('Attended')) {
                        const m = key.split(' ')[0];
                        if (updatedRow[`${m} %`]) updatedRow.originalRow[`${m} %`] = updatedRow[`${m} %`];
                        if (updatedRow[`${m} Stipend`]) updatedRow.originalRow[`${m} Stipend`] = updatedRow[`${m} Stipend`];
                    }
                }
                return updatedRow;
            }
            return row;
        });
        onUpdateData(newData);
    };

    const startEditing = (row, key) => {
        setEditingCell({ id: row.id, key });
        setEditValue(row[key]);
    };

    const saveEdit = () => {
        if (!editingCell) return;
        const { id, key } = editingCell;
        handleSave(id, key, editValue);
        setEditingCell(null);
        setEditValue('');
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEdit();
        }
    };

    // Filter keys for display
    const allKeys = new Set();
    data.forEach(row => {
        Object.keys(row).forEach(k => {
            if (k && k.trim() !== '' && !k.startsWith('__')) allKeys.add(k);
        });
    });

    // --- Column Configuration & Mapping ---
    const RENAMED_HEADERS = {
        "Photo (Proper Scanned Image- Max size up to 200 kb)": "Photo",
        "Retype Bank Account Number": "Account No.",
        "Self Attested scanned copy of Aadhaar Card. (PDF/Image - File Size up to 500 KB)": "Aadhar Card",
        "Self Attested scanned copy of Bank Passbook / Cheque Book / Bank Statement. ( PDF/Image - File Size up to 500 KB)": "PassBook",
        "Signature (Proper Scanned Image- Max size up to 100 kb)": "Signature",
        "Username": "Email",
        "Roll Number": "Roll No.",
        "Birth Place": "Domicile",
        "Birth Place_1": "Birth Place",
        "Sub Caste (as mentioned in SEBC/SC/ST caste certificate)": "Sub Caste",
        "Student Name (Same As per Bank Records)": "Student Name (Bank)", 
    };

    const isHidden = (key) => {
        const lower = key.toLowerCase();
        return lower.includes('timestamp') || (lower.includes('term') && lower.length > 50) || lower === 't&c';
    };

    const getDisplayName = (key) => {
        // Attendance Columns
        if (key.includes('Total') || key.includes('Attended') || key.includes('%') || key.includes('Stipend')) {
             if (key.includes('Total')) return 'Total Days'; // Month will be added in subtitle
             if (key.includes('Attended')) return 'Attended';
             if (key.includes('%')) return '%';
             if (key.includes('Stipend')) return 'Stipend';
        }
        
        return RENAMED_HEADERS[key] || key;
    };

    // --- Helper to find keys by patterns --- 
    const findLike = (term) => Array.from(allKeys).find(k => k.toLowerCase().includes(term.toLowerCase()));
    
    // Explicit Ordering Keys
    const rollKey = Array.from(allKeys).find(k => k === 'Roll Number') || findLike('Roll No');
    const nameFullKey = findLike('Name of Student (Full Name)') || findLike('Full Name') || findLike('Student Name (Full Name)');
    const nameAadharKey = findLike('Student Name (Same As per aadhar'); 
    const nameBankKey = findLike('Student Name (Same As per Bank');
    const categoryKey = findLike('Category') || findLike('Caste');
    const subCasteKey = findLike('Sub Caste') || findLike('Subcast'); 
    
    // Define the specific sequence
    const priorityKeys = [
        rollKey, 
        nameFullKey,
        nameAadharKey, 
        nameBankKey, 
        categoryKey, 
        subCasteKey
    ].filter(Boolean);

    // Attendance Keys for Selected Month
    const attendanceKeys = [
        `${selectedMonth} Total`,
        `${selectedMonth} Attended`,
        `${selectedMonth} %`,
        `${selectedMonth} Stipend`
    ];

    // Other keys: everything else not hidden, not priority, not attendance
    const otherKeys = Array.from(allKeys).filter(k => 
        !priorityKeys.includes(k) && 
        !isHidden(k) &&    
        !['id', 'internalStatus', 'statusColor', 'originalRow'].includes(k) &&
        !months.some(m => k.startsWith(m + ' ')) // Filter out OTHER months' data if present in row
    ).sort(); // Sort others alphabetically or keep original? Sort is safer for consistency.

    // Final Display Order
    const displayKeys = [...priorityKeys, ...attendanceKeys, ...otherKeys];

    // Helper to check if a value is a URL
    const isURL = (value) => {
        if (!value || typeof value !== 'string') return false;
        return value.startsWith('http://') || value.startsWith('https://');
    };

    // Filter data based on search query
    const filteredData = data.filter(row => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return displayKeys.some(key => {
            const value = row[key];
            return value && String(value).toLowerCase().includes(query);
        });
    });

    const handleBulkAdd = (e) => {
        e.preventDefault();
        if (!newFieldName) return;

        const updatedData = data.map(row => ({
            ...row,
            [newFieldName]: newFieldValue
        }));

        // Also update originalRow so exports work correctly
        updatedData.forEach(row => {
            row.originalRow[newFieldName] = newFieldValue;
        });

        onUpdateData(updatedData);
        setNewFieldName('');
        setNewFieldValue('');
        setShowAddModal(false);
    };

    const handleBulkUpdateTotalDays = () => {
        if (!bulkTotalDays || !selectedMonth) return;

        const { totalKey, attendedKey } = resolveMonthAttendanceKeys(data, selectedMonth);
        const hasMonthAttendanceColumn = data.some(row => Object.prototype.hasOwnProperty.call(row, attendedKey));
        if (!hasMonthAttendanceColumn) {
            alert(`No "${selectedMonth} Attended" data found. Import/add attendance for ${selectedMonth} first.`);
            return;
        }
        let updateCount = 0;
        const updatedData = data.map(row => {
            // Only update if this student has attendance data for this month
            const hasAttended = Object.prototype.hasOwnProperty.call(row, attendedKey);
            const attendedValue = row[attendedKey];
            const hasUsableAttended = attendedValue !== undefined && attendedValue !== null && String(attendedValue).trim() !== '';
            if (hasAttended && hasUsableAttended) {
                updateCount++;
                const { percent, stipend } = calculateStipend(bulkTotalDays, attendedValue);
                const updates = {
                    [totalKey]: bulkTotalDays,
                    [`${selectedMonth} %`]: percent,
                    [`${selectedMonth} Stipend`]: stipend
                };

                const newRow = { ...row, ...updates };
                if (newRow.originalRow) {
                    newRow.originalRow = { ...newRow.originalRow, ...updates };
                }
                return newRow;
            }
            return row;
        });

        onUpdateData(updatedData);
        setBulkTotalDays('');
        alert(`Updated Total Days to ${bulkTotalDays} for ${updateCount} students in ${selectedMonth}`);
    };



    // Helper to find loosely matching keys
    const findKey = (obj, target) => {
        if (!obj) return null;
        const normalizedTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
        return Object.keys(obj).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTarget);
    };

    const handleAttendanceCSV = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if file format is supported
        if (!isSupportedFileFormat(file)) {
            alert('Please upload a valid file (CSV, XLSX, or XLS)');
            return;
        }

        try {
            // Parse the file (handles both CSV and Excel)
            const results = await parseFile(file);

            const attendedMap = new Map();
            let matchCount = 0;

            results.forEach(row => {
                // Try getting Roll Number with various loose matches from the file row
                // We look for 'rollnumber', 'rollno', 'rollid' etc.
                const rollKey = findKey(row, 'rollnumber') || findKey(row, 'rollno') || findKey(row, 'rollid') || findKey(row, 'rollnoasperattendancemuster');
                const roll = rollKey ? String(row[rollKey]).trim() : null;

                if (!roll) return;

                if (!attendedMap.has(roll)) attendedMap.set(roll, {});
                const studentRecord = attendedMap.get(roll);

                const monthKey = findKey(row, 'month');
                // Find "Total" and "Attended/Present" columns loosely
                const totalKey = Object.keys(row).find(k => k.toLowerCase().includes('total') || k.toLowerCase().includes('working'));
                // Look for 'attended', 'present', or 'days' (but not 'total days')
                const attendedKey = Object.keys(row).find(k => {
                    const lower = k.toLowerCase();
                    return (lower.includes('attended') || lower.includes('present')) && !lower.includes('total') && !lower.includes('working');
                });

                const month = monthKey ? row[monthKey] : null;
                const total = totalKey ? row[totalKey] : null;
                const attended = attendedKey ? row[attendedKey] : null;

                const normalizedMonth = normalizeMonth(month);
                if (normalizedMonth && total && attended) {
                    const { percent, stipend } = calculateStipend(total, attended);
                    const m = normalizedMonth;

                    studentRecord[`${m} Total`] = total;
                    studentRecord[`${m} Attended`] = attended;
                    studentRecord[`${m} %`] = percent;
                    studentRecord[`${m} Stipend`] = stipend;
                }
            });

            let updatedCount = 0;
            const updatedData = data.map(row => {
                // Match with main data Roll Number
                // We look for similar patterns in the main data row
                const rollKey = findKey(row, 'rollnumber') || findKey(row, 'rollno') || findKey(row, 'rollid') || 'Roll Number';
                const roll = row[rollKey] ? String(row[rollKey]).trim() : null;

                const updates = attendedMap.get(roll);

                if (updates) {
                    updatedCount++;
                    // MERGE instead of replace - preserve existing month data
                    const newRow = { ...row, ...updates };
                    if (newRow.originalRow) {
                        newRow.originalRow = { ...newRow.originalRow, ...updates };
                    }
                    return newRow;
                }
                return row;
            });

            if (updatedCount === 0) {
                alert('No matching students found. Please check if "Roll Number" columns match properly.');
            } else {
                alert(`Successfully updated attendance for ${updatedCount} students.`);
            }

            onUpdateData(updatedData);
            setShowAttModal(false);
            // Clear file input to allow re-upload
            e.target.value = null;
        } catch (err) {
            alert('Error processing file: ' + err.message);
            console.error(err);
        }
    };

    const handleManualAttSubmit = (e) => {
        e.preventDefault();
        if (!attMonth || !attTotalDays || !attAttended) return;

        const { percent, stipend } = calculateStipend(attTotalDays, attAttended);
        const prefix = normalizeMonth(attMonth);
        if (!prefix) {
            alert('Invalid month. Use Jan/January or month number (1-12).');
            return;
        }

        const updatedData = data.map(row => {
            const updates = {
                [`${prefix} Total`]: attTotalDays,
                [`${prefix} Attended`]: attAttended,
                [`${prefix} %`]: percent,
                [`${prefix} Stipend`]: stipend
            };

            const newRow = { ...row, ...updates };
            if (newRow.originalRow) {
                newRow.originalRow = { ...newRow.originalRow, ...updates };
            }
            return newRow;
        });

        onUpdateData(updatedData);
        setShowAttModal(false);
        setAttMonth('');
        setAttTotalDays('');
        setAttAttended('');
    };

    const handleCSVImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check if file format is supported
        if (!isSupportedFileFormat(file)) {
            alert('Please upload a valid file (CSV, XLSX, or XLS)');
            return;
        }

        try {
            // Parse the file (handles both CSV and Excel)
            const results = await parseFile(file);

            // Append new rows. We assume they are approved or just raw data? 
            // Let's mark them as "Imported" status or just Approved default.
            // User wanted to "add option to manually add some fields OR upload a CSV"
            // Assuming upload means ADDING MORE DATA implies appending.

            const currentMaxId = Math.max(...data.map(d => d.id), 0);

            const newRows = results.map((row, idx) => ({
                ...row,
                id: currentMaxId + 1 + idx,
                internalStatus: 'Approved', // Auto-approve imported manual data?
                statusColor: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
                originalRow: row
            }));

            onUpdateData([...data, ...newRows]);
        } catch (err) {
            alert('Error processing file: ' + err.message);
            console.error(err);
        }
    };

    const exportWordReport = async () => {
        // Find keys
        const categoryKey = Object.keys(data[0] || {}).find(k =>
            k.toLowerCase().includes('category') || k.toLowerCase().includes('caste')
        );
        const genderKey = Object.keys(data[0] || {}).find(k =>
            k.toLowerCase().includes('gender') || k.toLowerCase().includes('sex')
        );
        const nameKey = Object.keys(data[0] || {}).find(k =>
            k.toLowerCase().includes('name') && !k.toLowerCase().includes('username')
        );
        const rollKey = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('roll'));
        const subCastKey = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('sub') && k.toLowerCase().includes('cast'));

        const { attendanceKey, stipendKey } = resolveMonthKeys(data, selectedMonth);

        const categories = ['GENERAL', 'SEBC', 'SC', 'ST'];
        const categoryData = {};
        categories.forEach(cat => {
            categoryData[cat] = data.filter(row => {
                const rowCat = String(row[categoryKey] || '').toUpperCase().trim();
                return rowCat === cat || rowCat.includes(cat);
            });
        });

        const createTable = (headerRow, dataRows) => {
            return new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: headerRow.map(h => new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })], alignment: AlignmentType.CENTER })],
                            shading: { fill: "F2F2F2" }
                        }))
                    }),
                    ...dataRows.map(row => new TableRow({
                        children: row.map(cell => new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: String(cell) })], alignment: AlignmentType.CENTER })]
                        }))
                    }))
                ]
            });
        };

        const docSections = [];

        // 1. Intro Section
        docSections.push({
            children: [
                new Paragraph({ children: [new TextRun({ text: "સાદર રજૂ,", bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: "\tસ્વર્ણિમ, ગાંધીનગર ખાતે ચાલતા યુપીએસસી સિવિલ સર્વિસીસ પરીક્ષા સ્ટડી સેન્ટરના ઉમેદવારોને સામાન્ય વહીવટ વિભાગના મૂળ ઠરાવ તા.૨૯/૦૭/૨૦૧૧ મુજબના મુદ્દા નં.૧ માં, “ઉમેદવારોને સ્ટડી ગ્રાન્ટ સ્વર્ણિમ દ્વારા નક્કી કરવામાં આવે તે પ્રકારની તેઓની પર્યાપ્ત હાજરીના પ્રમાણની ચકાસણી બાદ આપવામાં આવશે” તેમ દર્શાવેલ છે. સા.વ.વિ.ના તા.૨૧/૦૫/૨૦૧૫ના ઠરાવ : વતપ-૧૦૨૦૧૧/૪૯૮/વસાલ-૪ માંના મુદ્દા નં. ૧ પ્રમાણે, “સંસ્થા ખાતે તાલીમવર્ગમાં પ્રવેશ મેળવનાર પ્રત્યેક તાલીમાર્થીને વધુમાં વધુ સાત માસ સુધી અથવા યુ.પી.એસ.સી. દ્વારા અખિલ ભારતીય મુલ્કી સેવા અને સંલગ્ન પ્રિલિમ પરીક્ષા લેવાય ત્યાં સુધી આ બે માંથી જે ઓછું હોય તે મુદત માટે માસિક રૂ.૨૦૦૦/-(રૂપિયા બે હજાર) સ્ટાઈપેન્ડ તરીકે આપવામાં આવશે. ” તેમ દર્શાવેલ છે. " })] }),
                new Paragraph({ children: [new TextRun({ text: "" })] }),
                new Paragraph({ children: [new TextRun({ text: "૨.\t સંસ્થાના તા. ૧૭/૦૫/૨૦૧૭ ના પરિપત્ર અનુસંધાને “ સરદાર પટેલ લોક પ્રશાસન સંસ્થા, અમદાવાદ અને તેના હસ્તકના તાલીમ કેન્દ્રોમાં ચાલતા કેન્દ્રીય જાહેર સેવા આયોગ દ્વારા લેવામાં આવતી અખિલ ભારતીય મુલ્કી સેવા અને સંલગ્ન પરીક્ષા માટેના પ્રિલિમ પરીક્ષા તાલીમવર્ગમાં પ્રવેશ મેળવતા તમામ યુવક/યુવતીઓને યુપીએસસી સિવિલ સર્વિસીસ પ્રિલિમ પરીક્ષાના તાલીમવર્ગમાં જે ઉમેદવારોની હાજરી ૭૫% કે તેથી વધુ હોય તેવા ઉમેદવારોને પ્રતિ માસ રૂ. ૨,૦૦૦/- ( અંકે રૂપિયા બે હજાર પુરા) (વધુમાં વધુ સાત મહિના સુધી અથવા યુપીએસસી દ્વારા અખિલ ભારતીય મુલ્કી સેવા અને સંલગ્ન પરીક્ષા લેવાય ત્યાં સુધી, આ બે માંથી જે ઓછું હોય તે) પ્રોત્સાહન આપવામાં આવશે, જેનો અમલ યુપીએસસી સિવિલ સર્વિસીસ પ્રિલિમ પરીક્ષા ૨૦૨૪ ના તાલીમ વર્ગ ૨૦૨૪-૨૫ ની નવી બેચથી કરવાનો રહેશે.”તે પ્રમાણે નિર્ણય લેવામાં આવેલ છે.", bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: "" })] }),
                new Paragraph({ children: [new TextRun({ text: `૩.\t સંસ્થા ખાતે યુપીએસસી સિવિલ સર્વિસીસ પ્રશિક્ષણ વર્ગ ૨૦૨૪-૨૫ ના તાલીમવર્ગ તા.૦૧/૧૧/૨૦૨૪ થી શરૂ કરવામાં આવેલ છે. યુપીએસસી સિવિલ સર્વિસીસ પ્રશિક્ષણવર્ગ ૨૦૨૪-૨૫ ના માસિક પ્રોત્સાહન સહાય મેળવવા ઈચ્છુક તાલીમાર્થીઓ પાસેથી તા. ૦૪.૧૨.૨૦૨૪ થી ૧૨.૧૨.૨૦૨૪ દરમિયાન ગૂગલ ફોર્મ મારફત ઓનલાઈન અરજી મંગાવવામાં આવેલ. સદર તાલીમવર્ગના કુલ ૧૧૫ તાલીમાર્થીઓએ ગૂગલ ફોર્મ મારફત પ્રોત્સાહન સહાય મેળવવા સારું અરજી કરેલ છે. તેઓની વિગત આ સાથે સામેલ છે. ` })] }),
                new Paragraph({ children: [new TextRun({ text: "" })] }),
            ]
        });

        // 2. Incomplete/Non-Domicile Table
        const reviewStudents = data.filter(row => row.internalStatus === 'Review');
        if (reviewStudents.length > 0) {
            const reviewRows = reviewStudents.map((s, i) => [
                i + 1,
                s[nameKey] || '',
                s[rollKey] || '',
                s.ReviewReason || 'Incomplete application'
            ]);
            docSections[0].children.push(
                new Paragraph({ children: [new TextRun({ text: `નીચે કોષ્ટકમાં દર્શાવ્યા મુજબના કુલ ${reviewStudents.length} ઉમેદવારની અરજીઓ ચકાસતા ક્રમ ૧ અરજદાર, સા.વ.વિ.ના તા.૨૧/૦૫/૨૦૧૫ના ઠરાવ : વતપ-૧૦૨૦૧૧/૪૯૮/વસાલ-૪ માંના મુદ્દા નં. ૨ પ્રમાણે અરજદાર ગુજરાતના ડોમિસાઈલ ન હોય, આથી અરજી ના મંજૂર કરીએ અને ક્રમ ૨ થી ૧૮ ના અરજદારની અરજી અધૂરી વિગતો હોય, તેઓને જરૂરી વિગતો ભરવા હાલ અરજી પરત કરીએ.` })] }),
                createTable(["Sr No", "Full Name", "Application No", "Remarks"], reviewRows),
                new Paragraph({ children: [new TextRun({ text: "" })] })
            );
        }

        // 3. Category Sections
        docSections[0].children.push(
            new Paragraph({ children: [new TextRun({ text: `૪.\t સંસ્થા, ગાંધીનગર ખાતે યુપીએસસી સિવિલ સર્વિસીસ પ્રિલિમ પરીક્ષા તાલીમવર્ગ ૨૦૨૪-૨૫ માં પ્રવેશ મેળવેલ તમામ ૧૧૨ તાલીમાર્થીઓની હાજરીની વિગતો સામેલ છે. સંસ્થાના તા. ૧૭/૦૫/૨૦૧૭ ના પરિપત્ર મુજબ હાજરીની ચકાસણી કરતા ${selectedMonth} માસનું માસિક પ્રોત્સાહન સહાય નીચે મુજબના ઉમેદવારોને Annexure- A, B, C, D ની વિગતે મળવાપાત્ર થાય છે.` })] })
        );

        const annexures = { 'GENERAL': 'A', 'SEBC': 'B', 'SC': 'C', 'ST': 'D' };
        let grandTotalStipend = 0;
        let totalCount = 0;

        categories.forEach(cat => {
            const catStudents = categoryData[cat].filter(s => s[attendanceKey] !== undefined);
            if (catStudents.length === 0) return;

            const isGeneral = cat === 'GENERAL';
            const attHeader = `Month (${selectedMonth})`;
            const stpHeader = 'Stipend';

            const rows = catStudents.map((s, i) => {
                const row = [i + 1, s[rollKey] || '', s[nameKey] || '', s[genderKey] || ''];
                if (!isGeneral) row.push(s[subCastKey] || '');
                row.push(s[attendanceKey] || '0%');
                row.push(toAmount(s[stipendKey]).toLocaleString());
                return row;
            });

            const catTotal = catStudents.reduce((sum, s) => sum + toAmount(s[stipendKey]), 0);
            const totalRow = ['', '', 'TOTAL', ''];
            if (!isGeneral) totalRow.push('');
            totalRow.push('');
            totalRow.push(catTotal.toLocaleString());
            rows.push(totalRow);

            grandTotalStipend += catTotal;
            totalCount += catStudents.length;

            const headers = ["Sr. No", "Roll No", "Student name", "Gen der"];
            if (!isGeneral) headers.push("Sub Cast");
            headers.push(attHeader, stpHeader);

            docSections[0].children.push(
                new Paragraph({ children: [new TextRun({ text: `ANNEXURE – ${annexures[cat]}`, bold: true })] }),
                new Paragraph({ children: [new TextRun({ text: `${cat} CATEGORY`, bold: true })] }),
                createTable(headers, rows),
                new Paragraph({ children: [new TextRun({ text: "" })] })
            );
        });

        // 4. Grand Summary Table
        const summaryRows = categories.map(cat => {
            const catStudents = categoryData[cat].filter(s => s[attendanceKey] !== undefined);
            const male = catStudents.filter(s => ['M', 'MALE'].includes(String(s[genderKey]).toUpperCase()));
            const female = catStudents.filter(s => ['F', 'FEMALE'].includes(String(s[genderKey]).toUpperCase()));
            const mAmt = male.reduce((sum, s) => sum + toAmount(s[stipendKey]), 0);
            const fAmt = female.reduce((sum, s) => sum + toAmount(s[stipendKey]), 0);
            return [
                cat,
                male.length, mAmt.toLocaleString(),
                female.length, fAmt.toLocaleString(),
                catStudents.length, (mAmt + fAmt).toLocaleString()
            ];
        });

        const totalM = summaryRows.reduce((a, b) => a + b[1], 0);
        const totalMA = summaryRows.reduce((a, b) => a + toAmount(b[2]), 0);
        const totalF = summaryRows.reduce((a, b) => a + b[3], 0);
        const totalFA = summaryRows.reduce((a, b) => a + toAmount(b[4]), 0);

        summaryRows.push([
            "Total",
            totalM, totalMA.toLocaleString(),
            totalF, totalFA.toLocaleString(),
            totalM + totalF, (totalMA + totalFA).toLocaleString()
        ]);

        docSections[0].children.push(
            new Paragraph({ children: [new TextRun({ text: "Grand Total of All Categories", bold: true })] }),
            createTable(["Category", "Male No", "Male Amt", "Female No", "Female Amt", "Total", "Amount (Rs.)"], summaryRows),
            new Paragraph({ children: [new TextRun({ text: "" })] }),
            new Paragraph({ children: [new TextRun({ text: `૫.\t ઉપર કોષ્ટક-૫ માં દર્શાવેલ કેટેગરી વાઈઝ પત્રકના કુલ ${totalCount} તાલીમાર્થીઓને કુલ રૂ. ${grandTotalStipend.toLocaleString()}/- (અંકે રૂપિયા ${grandTotalStipend.toLocaleString()} પુરા)ની ચુકવણી કરવાની થાય છે. ઉક્ત ઉમેદવારોને તેઓની બેન્ક વિગતો મુજબ ચુકવવા પાત્ર કુલ રકમ RTGS/NEFT દ્વારા તેઓના બેન્ક ખાતામાં જમા કરાવવા સારું હિસાબી શાખાને હુકમ કરીએ. વધુમાં હિસાબી શાખાને જણાવીએ કે ઉક્ત વિગતે ચુકવણી કર્યા બાદ સ્ટડી શાખાને લેખિતમાં જાણ કરવાની રહેશે.` })] }),
            new Paragraph({ children: [new TextRun({ text: "" })] }),
            new Paragraph({ children: [new TextRun({ text: "૬.\t સા.વ. વિ.ના તા.૨૧-૦૫-૨૦૧૫ના ઠરાવ ક્રમાંક:વતપ-૧૦૨૦૧૧/૪૯૮/વસાલ-૪ ના મુદ્દા નં. ૫ થી ૭ મુજબ, ઉક્ત પેરા-૫ માં દર્શાવેલ તાલીમાર્થીઓને કુલ રૂ. ${grandTotalStipend.toLocaleString()}/- (અંકે રૂપિયા ${grandTotalStipend.toLocaleString()} પુરા) માંથી નીચે મુજબના સદર હેઠળ ચાલુ નાણાકીય વર્ષની ગ્રાન્ટમાંથી ચુકવણી કરવાનું રહે છે." })] }),
        );

        const doc = new Document({
            sections: docSections
        });

        const buffer = await Packer.toBlob(doc);
        saveAs(buffer, `NOTING_${selectedMonth}_Report.docx`);
        alert(`Generated ${selectedMonth} Word Report!`);
    };
    // Helper to download CSV
    const downloadCSV = (csvContent, filename) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(link.href), 250);
    };

    const downloadCSVBatch = (files) => {
        files.forEach((file, index) => {
            setTimeout(() => {
                downloadCSV(file.csvContent, file.filename);
            }, index * 180);
        });
    };

    const exportFinal = () => {
        // Find keys
        const categoryKey = Object.keys(data[0] || {}).find(k =>
            k.toLowerCase().includes('category') || k.toLowerCase().includes('caste')
        );
        const genderKey = Object.keys(data[0] || {}).find(k =>
            k.toLowerCase().includes('gender') || k.toLowerCase().includes('sex')
        );
        const nameKey = Object.keys(data[0] || {}).find(k =>
            k.toLowerCase().includes('name') && !k.toLowerCase().includes('username')
        );
        const rollKey = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('roll'));
        const subCastKey = Object.keys(data[0] || {}).find(k => k.toLowerCase().includes('sub') && k.toLowerCase().includes('cast'));

        if (!categoryKey) {
            alert('Category column not found in data!');
            return;
        }

        // Attendance and stipend keys for the selected month, with fallback for legacy month formats.
        const { attendanceKey, stipendKey } = resolveMonthKeys(data, selectedMonth);

        if (!data.some(row => Object.prototype.hasOwnProperty.call(row, attendanceKey))) {
            alert(`No attendance data found for ${selectedMonth}.`);
            return;
        }

        // Group by category
        const categories = ['GENERAL', 'SEBC', 'SC', 'ST'];
        const categoryData = {};

        categories.forEach(cat => {
            categoryData[cat] = data.filter(row => {
                const rowCat = String(row[categoryKey] || '').toUpperCase().trim();
                return rowCat === cat || rowCat.includes(cat);
            });
        });

        // Generate summary table (Specific to selected month)
        const summaryRows = [];
        let totalMaleCount = 0, totalFemaleCount = 0;
        let totalMaleAmount = 0, totalFemaleAmount = 0;

        categories.forEach(cat => {
            const catStudents = categoryData[cat];

            // For summary, we only count students who have attendance data for this month
            const monthStudents = catStudents.filter(s => s[attendanceKey] !== undefined);

            const maleStudents = monthStudents.filter(s => {
                const gender = String(s[genderKey] || '').toUpperCase();
                return gender === 'M' || gender === 'MALE';
            });
            const femaleStudents = monthStudents.filter(s => {
                const gender = String(s[genderKey] || '').toUpperCase();
                return gender === 'F' || gender === 'FEMALE';
            });

            const maleAmount = maleStudents.reduce((sum, s) => sum + toAmount(s[stipendKey]), 0);
            const femaleAmount = femaleStudents.reduce((sum, s) => sum + toAmount(s[stipendKey]), 0);

            summaryRows.push({
                'Category': cat,
                'Male No': maleStudents.length,
                'Male Amount': maleAmount.toLocaleString(),
                'Female No': femaleStudents.length,
                'Female Amount': femaleAmount.toLocaleString(),
                'Total Candidates': monthStudents.length,
                'Amount (Rs.)': (maleAmount + femaleAmount).toLocaleString()
            });

            totalMaleCount += maleStudents.length;
            totalFemaleCount += femaleStudents.length;
            totalMaleAmount += maleAmount;
            totalFemaleAmount += femaleAmount;
        });

        // Add total row
        summaryRows.push({
            'Category': 'Total',
            'Male No': totalMaleCount,
            'Male Amount': totalMaleAmount.toLocaleString(),
            'Female No': totalFemaleCount,
            'Female Amount': totalFemaleAmount.toLocaleString(),
            'Total Candidates': totalMaleCount + totalFemaleCount,
            'Amount (Rs.)': (totalMaleAmount + totalFemaleAmount).toLocaleString()
        });

        const filesToDownload = [];
        filesToDownload.push({
            csvContent: Papa.unparse(summaryRows),
            filename: `summary_${selectedMonth.toLowerCase()}.csv`
        });

        // Generate category-specific CSVs
        categories.forEach(cat => {
            const catStudents = categoryData[cat].filter(s => s[attendanceKey] !== undefined);
            if (catStudents.length === 0) return;

            const isGeneral = cat === 'GENERAL';
            const attHeader = `Month (${selectedMonth})`;
            const stpHeader = 'Stipend';

            // Prepare export data with restricted columns
            const exportData = catStudents.map((row, index) => {
                const item = {
                    'Sr. No': index + 1,
                    'Roll No': row[rollKey] || '',
                    'Student name': row[nameKey] || '',
                    'Gen der': row[genderKey] || '',
                };

                if (!isGeneral) {
                    item['Sub Cast'] = row[subCastKey] || '';
                }

                item[attHeader] = row[attendanceKey] || '0%';
                item[stpHeader] = toAmount(row[stipendKey]);

                return item;
            });

            // Calculate total stipend for this category/month
            const totalStipendForCat = catStudents.reduce((sum, s) => sum + toAmount(s[stipendKey]), 0);

            // Add TOTAL row at the bottom
            const totalRow = {
                'Sr. No': '',
                'Roll No': '',
                'Student name': 'TOTAL',
                'Gen der': '',
            };
            if (!isGeneral) totalRow['Sub Cast'] = '';
            totalRow[attHeader] = '';
            totalRow[stpHeader] = totalStipendForCat;

            const finalExportData = [...exportData, totalRow];

            // Full data (all students with attendance for this month)
            filesToDownload.push({
                csvContent: Papa.unparse(finalExportData),
                filename: `${cat.toLowerCase()}_full_${selectedMonth.toLowerCase()}.csv`
            });

            // Eligible data (stipend > 0)
            const eligibleRows = exportData.filter(row => (row[stpHeader] || 0) > 0);
            if (eligibleRows.length > 0) {
                // Copy the rows to avoid modifying the 'full' data Sr. No
                const eligibleExportDataRows = eligibleRows.map((r, i) => ({ ...r, 'Sr. No': i + 1 }));
                const totalEligibleStipend = eligibleExportDataRows.reduce((sum, s) => sum + (s[stpHeader] || 0), 0);

                // Add total row for eligible list
                const eligibleTotalRow = { ...totalRow, [stpHeader]: totalEligibleStipend };
                const eligibleExportData = [...eligibleExportDataRows, eligibleTotalRow];

                filesToDownload.push({
                    csvContent: Papa.unparse(eligibleExportData),
                    filename: `${cat.toLowerCase()}_eligible_${selectedMonth.toLowerCase()}.csv`
                });
            }
        });

        downloadCSVBatch(filesToDownload);
        alert(`Generated ${filesToDownload.length} ${selectedMonth} CSV file(s). Check your downloads folder.`);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 rounded-full transition-colors hover:bg-slate-800">
                        <ArrowLeft className="w-6 h-6 text-slate-400" />
                    </button>
                    <div>
                        <h2 className="text-2xl font-bold text-white">Enrichment Phase</h2>
                        <p className="text-sm text-slate-400">Add custom fields or merge data</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <h2 className="text-xl font-semibold text-white/90 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-purple-400" />
                    Enrichment Panel
                </h2>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Search Input */}
                    <input
                        type="text"
                        placeholder="Search students..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50 w-full md:w-48 bg-slate-800/50 border border-slate-700 text-slate-300 placeholder-slate-500"
                    />

                    {/* Month Selector */}
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50 bg-slate-800/50 border border-slate-700 text-slate-300"
                    >
                        {months.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>

                    {/* Bulk Update Total Days */}
                    <div className="flex gap-2 items-center">
                        <input
                            type="number"
                            placeholder={`${selectedMonth} Total Days`}
                            value={bulkTotalDays}
                            onChange={(e) => setBulkTotalDays(e.target.value)}
                            className="rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500/50 w-32 bg-slate-800/50 border border-slate-700 text-slate-300 placeholder-slate-500"
                        />
                        <button
                            onClick={handleBulkUpdateTotalDays}
                            disabled={!bulkTotalDays}
                            className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-blue-400 border border-blue-500/20 hover:bg-blue-500/10"
                        >
                            Apply to All
                        </button>
                    </div>

                    <button onClick={() => setShowAttModal(true)} className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10">
                        <Calendar className="w-4 h-4" />
                        <span className="hidden sm:inline">Attendance</span>
                    </button>
                    <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2 px-3 py-2">
                        <Plus className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Field</span>
                    </button>
                    <button onClick={exportFinal} className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export CSV</span>
                    </button>
                    <button onClick={exportWordReport} className="px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white">
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline">Export Word</span>
                    </button>
                </div>
            </div>
            <div className="glass-panel rounded-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto max-h-[70vh]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider sticky top-0 backdrop-blur-md z-10">
                                {displayKeys.map(key => {
                                    // Use getDisplayName from logic scope
                                    const displayName = getDisplayName(key);
                                    // Check if it's an attendance key for special formatting
                                    const isAttendance = key.startsWith(`${selectedMonth} `) && (key.includes('Total') || key.includes('Attended') || key.includes('%') || key.includes('Stipend'));
                                    
                                    return (
                                        <th key={key} className="p-4 font-medium whitespace-nowrap align-bottom">
                                            {isAttendance ? (
                                                <div className="flex flex-col gap-0.5">
                                                    <span>{displayName}</span>
                                                    <span className="text-[10px] opacity-70 font-normal">({selectedMonth})</span>
                                                </div>
                                            ) : (
                                                displayName
                                            )}
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {filteredData.map((row) => (
                                <tr key={row.id} className="transition-colors hover:bg-slate-800/40">
                                    {displayKeys.map(key => {
                                        const isEditing = editingCell?.id === row.id && editingCell?.key === key;
                                        return (
                                            <td
                                                key={key}
                                                onDoubleClick={() => startEditing(row, key)}
                                                className={clsx(
                                                    "p-4 max-w-xs border-r border-slate-800/50 last:border-0 text-slate-300",
                                                    isEditing && 'p-2'
                                                )}
                                                title={!isEditing && typeof row[key] === 'string' ? row[key] : ''}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        type="text"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onBlur={saveEdit}
                                                        onKeyDown={handleKeyDown}
                                                        className="w-full border border-blue-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-900 text-white"
                                                    />
                                                ) : isURL(row[key]) ? (
                                                    <a
                                                        href={row[key]}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 px-3 py-1 rounded border text-xs transition-colors bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30"
                                                    >
                                                        <span>View</span>
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </a>
                                                ) : (
                                                    <span className="cursor-text block w-full h-full min-h-[1.5em] hover:text-white">{row[key]}</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-3 bg-slate-900/50 border-t border-slate-800 text-xs text-slate-500 flex justify-between">
                    <span>Showing {data.length} records</span>
                    <span>{displayKeys.length} columns</span>
                </div>
            </div>

            {/* Bulk Add Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="glass-panel w-full max-w-md rounded-2xl p-6 relative animate-in zoom-in-95">
                            <h3 className="text-xl font-bold mb-4 text-white">Add Field to All Data</h3>
                            <form onSubmit={handleBulkAdd} className="space-y-4">
                                <div>
                                    <label className="text-sm block mb-1 text-slate-400">Field Name (Column Header)</label>
                                    <input
                                        type="text"
                                        value={newFieldName}
                                        onChange={(e) => setNewFieldName(e.target.value)}
                                        placeholder="e.g. Scholarship Amount"
                                        className="w-full border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 bg-slate-800 text-white"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-sm block mb-1 text-slate-400">Default Value</label>
                                    <input
                                        type="text"
                                        value={newFieldValue}
                                        onChange={(e) => setNewFieldValue(e.target.value)}
                                        placeholder="e.g. 50000"
                                        className="w-full border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 bg-slate-800 text-white"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-4">
                                    <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                                    <button type="submit" disabled={!newFieldName} className="btn-primary">Add Field</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {/* Attendance Modal */}
            {
                showAttModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="glass-panel w-full max-w-md rounded-2xl p-6 relative animate-in zoom-in-95">
                            <h3 className="text-xl font-bold mb-4 text-white">Attendance Management</h3>

                            <div className="flex p-1 rounded-lg mb-6 bg-slate-800">
                                <button
                                    onClick={() => setAttMode('manual')}
                                    className={clsx(
                                        "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                                        attMode === 'manual'
                                            ? "bg-indigo-600 text-white shadow-lg"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    Manual Entry
                                </button>
                                <button
                                    onClick={() => setAttMode('csv')}
                                    className={clsx(
                                        "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                                        attMode === 'csv'
                                            ? "bg-indigo-600 text-white shadow-lg"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    CSV Upload
                                </button>
                            </div>

                            {attMode === 'manual' ? (
                                <form onSubmit={handleManualAttSubmit} className="space-y-4">
                                    <div>
                                        <label className="text-sm block mb-1 text-slate-400">Month Name</label>
                                        <input
                                            type="text"
                                            value={attMonth}
                                            onChange={(e) => setAttMonth(e.target.value)}
                                            placeholder="e.g. Jan"
                                            className="w-full border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 bg-slate-800 text-white"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-sm block mb-1 text-slate-400">Total Days</label>
                                            <input
                                                type="number"
                                                value={attTotalDays}
                                                onChange={(e) => setAttTotalDays(e.target.value)}
                                                placeholder="25"
                                                className="w-full border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 bg-slate-800 text-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm block mb-1 text-slate-400">Attended</label>
                                            <input
                                                type="number"
                                                value={attAttended}
                                                onChange={(e) => setAttAttended(e.target.value)}
                                                placeholder="20"
                                                className="w-full border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 bg-slate-800 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4">
                                        <button type="button" onClick={() => setShowAttModal(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                                        <button type="submit" className="btn-primary bg-emerald-600 hover:bg-emerald-500">Apply to All</button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-4 text-center py-4">
                                    <div className="p-8 border-2 border-dashed border-slate-700 rounded-xl hover:border-indigo-500/50 transition-colors bg-slate-800/30">
                                        <Upload className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                                        <p className="font-medium mb-1 text-slate-300">Upload Attendance File</p>
                                        <p className="text-xs mb-4 text-slate-500">Required columns: Roll Number, Month, Total Working Days, Attended Days. Supports CSV, XLSX, XLS</p>
                                        <label className="btn-primary cursor-pointer inline-flex">
                                            Select File
                                            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleAttendanceCSV} />
                                        </label>
                                    </div>
                                    <button type="button" onClick={() => setShowAttModal(false)} className="text-sm text-slate-400 hover:text-white transition-colors">Cancel</button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default EnrichmentPanel;
