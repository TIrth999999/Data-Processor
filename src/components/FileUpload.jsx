import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, AlertCircle, Database, Briefcase } from 'lucide-react';
import { clsx } from 'clsx';
import { processData } from '../utils/dataProcessor';
import { processExperienceData } from '../utils/experienceProcessor';
import { parseFile, isSupportedFileFormat, getFileTypeDescription } from '../utils/fileParser';

const FileUpload = ({ onDataProcessed }) => {
    const fileInputRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadMode, setUploadMode] = useState('stipend'); // 'stipend' | 'experience'

    const handleFile = async (file, mode) => {
        setError('');
        
        // Check if file format is supported
        if (!isSupportedFileFormat(file)) {
            setError('Please upload a valid file (CSV, XLSX, or XLS)');
            return;
        }

        setIsProcessing(true);
        
        try {
            // Parse the file (handles both CSV and Excel)
            const data = await parseFile(file);
            
            if (!data || data.length === 0) {
                setError('The file appears to be empty or has no valid data');
                setIsProcessing(false);
                return;
            }

            // Process the data based on mode
            let processed;
            if (mode === 'experience') {
                processed = processExperienceData(data);
                
                // Direct Download for Experience Mode
                const exportData = processed.map(row => row.originalRow);
                const csv = Papa.unparse(exportData);
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `processed_experience_${new Date().getTime()}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Show success feedback (using error state for now to reuse UI, but distinguishing safely would be better, 
                // but effectively we just stop processing and don't change screen)
                setIsProcessing(false);
                return; 
            } else {
                processed = processData(data);
            }
            
            onDataProcessed(processed);
        } catch (err) {
            setError(err.message || `Error processing ${getFileTypeDescription(file)} file. Please check the file format.`);
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    };

    const onDragOver = (e) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const onDragLeave = (e) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const onDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0], uploadMode);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file, uploadMode);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto my-12">
            {/* Mode Selection */}
            <div className="mb-6 p-1 rounded-xl bg-slate-800 transition-colors">
                <div className="flex gap-2">
                    <button
                        onClick={() => setUploadMode('stipend')}
                        className={clsx(
                            "flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                            uploadMode === 'stipend'
                                ? "bg-blue-600 text-white shadow-lg"
                                : "text-slate-400 hover:text-white"
                        )}
                    >
                        <Database className="w-5 h-5" />
                        <span>Process Stipend Data</span>
                    </button>
                    <button
                        onClick={() => setUploadMode('experience')}
                        className={clsx(
                            "flex-1 py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2",
                            uploadMode === 'experience'
                                ? "bg-blue-600 text-white shadow-lg"
                                : "text-slate-400 hover:text-white"
                        )}
                    >
                        <Briefcase className="w-5 h-5" />
                        <span>Process Experience Data</span>
                    </button>
                </div>
            </div>

            {/* Upload Area */}
            <div
                className={clsx(
                    "relative group cursor-pointer glass-panel rounded-2xl border-2 border-dashed transition-all duration-300 p-12 text-center overflow-hidden",
                    "border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/50",
                    isDragOver && "border-blue-500 bg-blue-500/10"
                )}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                />

                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className={clsx(
                        "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
                        isProcessing 
                            ? "bg-blue-500/20 animate-pulse"
                            : "bg-slate-800 group-hover:bg-blue-500/20"
                    )}>
                        {isProcessing ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        ) : (
                            <Upload className="w-10 h-10 text-slate-400 group-hover:text-blue-400 transition-colors" />
                        )}
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-white group-hover:text-blue-200 transition-colors">
                            {isProcessing ? "Processing Data..." : `Upload File - ${uploadMode === 'stipend' ? 'Stipend Data' : 'Experience Data'}`}
                        </h3>
                        <p className="text-sm text-slate-400">
                            {uploadMode === 'experience' 
                                ? 'File must contain "experience" column (format: years_months_days, e.g., 10_5_1). Supports CSV, XLSX, XLS'
                                : 'Drag & drop or click to browse. Supports CSV, XLSX, XLS formats'}
                        </p>
                    </div>
                </div>

                {/* Decorative Grid */}
                <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>
            </div>

            {error && (
                <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{error}</span>
                </div>
            )}
        </div>
    );
};

export default FileUpload;
