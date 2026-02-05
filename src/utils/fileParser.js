import Papa from 'papaparse';

/**
 * Parses a file (CSV or Excel) and returns the data as an array of objects
 * @param {File} file - The file to parse
 * @returns {Promise<Array>} - Promise that resolves to an array of objects
 */
export const parseFile = async (file) => {
  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
  
  // Check if it's an Excel file
  if (fileExtension === '.xlsx' || fileExtension === '.xls') {
    return parseExcelFile(file);
  }
  
  // Default to CSV
  return parseCSVFile(file);
};

/**
 * Parses a CSV file using PapaParse
 * @param {File} file - The CSV file
 * @returns {Promise<Array>} - Promise that resolves to an array of objects
 */
const parseCSVFile = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h, i) => {
        const clean = h ? h.trim() : '';
        return clean || `__empty_${i}`;
      },
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn("CSV Errors:", results.errors);
        }
        resolve(results.data);
      },
      error: (err) => {
        reject(new Error('Failed to parse CSV file: ' + err.message));
      }
    });
  });
};

/**
 * Parses an Excel file using XLSX (dynamically imported)
 * @param {File} file - The Excel file
 * @returns {Promise<Array>} - Promise that resolves to an array of objects
 */
const parseExcelFile = async (file) => {
  // Dynamically import xlsx to avoid build issues
  const XLSX = await import('xlsx');
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: '', // Default value for empty cells
          raw: false // Convert all values to strings
        });
        
        // Clean up empty rows and normalize headers
        const cleanedData = jsonData
          .map(row => {
            const cleanedRow = {};
            Object.keys(row).forEach(key => {
              const cleanKey = key ? key.trim() : '';
              if (cleanKey) {
                cleanedRow[cleanKey] = row[key] !== null && row[key] !== undefined ? String(row[key]).trim() : '';
              }
            });
            // Only include rows that have at least one non-empty value
            const hasData = Object.values(cleanedRow).some(val => val !== '');
            return hasData ? cleanedRow : null;
          })
          .filter(row => row !== null);
        
        resolve(cleanedData);
      } catch (err) {
        reject(new Error('Failed to parse Excel file: ' + err.message));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Checks if a file is a supported format
 * @param {File} file - The file to check
 * @returns {boolean} - True if the file format is supported
 */
export const isSupportedFileFormat = (file) => {
  const fileName = file.name.toLowerCase();
  const supportedExtensions = ['.csv', '.xlsx', '.xls'];
  return supportedExtensions.some(ext => fileName.endsWith(ext));
};

/**
 * Gets the file type description
 * @param {File} file - The file
 * @returns {string} - Description of the file type
 */
export const getFileTypeDescription = (file) => {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return 'Excel';
  }
  return 'CSV';
};
