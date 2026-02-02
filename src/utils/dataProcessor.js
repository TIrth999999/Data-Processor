
export const processData = (data) => {
    const processed = data.map((row, index) => {
        // Assuming "Birth Place" is column index 3 based on previous analysis
        // Or we can find it by header name if parsed with header: true
        // We will assume header: true in PapaParse

        // Normalize keys just in case
        const birthPlaceKey = Object.keys(row).find(k => k.trim().toLowerCase().includes("birth place")) || "Birth Place";
        const birthPlace = row[birthPlaceKey] || "";

        // Standardize Roll Number key
        // Find matching key
        const rollKey = Object.keys(row).find(k => {
            const clean = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            // Matches: Roll No, Roll Number, Roll No (As per attendance muster), Student No, etc.
            return ['rollnumber', 'rollno', 'rollid', 'studentno', 'rollnoasperattendancemuster'].includes(clean);
        });

        // Create a new row object to avoid mutating the original if needed, 
        // but we are returning a new object anyway.
        // We want to ENSURE 'Roll Number' exists.
        const normalizedRow = { ...row };

        if (rollKey) {
            const val = normalizedRow[rollKey];
            // If the key is not exactly "Roll Number", rename it
            if (rollKey !== 'Roll Number') {
                normalizedRow['Roll Number'] = val;
                delete normalizedRow[rollKey];
            }
        }

        let status = "Pending";
        let statusColor = "bg-yellow-500/20 text-yellow-300 border-yellow-500/50"; // Default

        if (birthPlace.includes("Within Territory of Gujarat State")) {
            status = "Approved";
            statusColor = "bg-green-500/20 text-green-300 border-green-500/50";
        } else if (birthPlace.includes("Outside") && birthPlace.includes("Have Domicile")) {
            status = "Review"; // This is the "Dominance Certificate" case to HIGHLIGHT
            statusColor = "bg-amber-500/20 text-amber-300 border-amber-500 box-shadow-glow";
        } else if (birthPlace.includes("Outside") && birthPlace.includes("Do not have")) {
            status = "Rejected";
            statusColor = "bg-red-500/20 text-red-300 border-red-500/50";
        }

        return {
            ...normalizedRow,
            id: index,
            internalStatus: status,
            statusColor,
            originalRow: normalizedRow // Keep normalized row for export so it has clean headers
        };
    });

    // Sort: Review students first, then others
    processed.sort((a, b) => {
        if (a.internalStatus === 'Review' && b.internalStatus !== 'Review') return -1;
        if (a.internalStatus !== 'Review' && b.internalStatus === 'Review') return 1;
        return 0; // Keep original order for same status
    });

    return processed;
};
