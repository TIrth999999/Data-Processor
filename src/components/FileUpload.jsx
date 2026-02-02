import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { processData } from '../utils/dataProcessor';

const FileUpload = ({ onDataProcessed }) => {
    const fileInputRef = useRef(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFile = (file) => {
        setError('');
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            setError('Please upload a valid CSV file');
            return;
        }

        setIsProcessing(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    console.error("CSV Errors:", results.errors);
                    // Show warning but proceed if data exists
                }

                try {
                    const processed = processData(results.data);
                    onDataProcessed(processed);
                } catch (err) {
                    setError('Error processing data. Please check CSV format.');
                    console.error(err);
                } finally {
                    setIsProcessing(false);
                }
            },
            error: (err) => {
                setError('Failed to parse CSV file');
                setIsProcessing(false);
            }
        });
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
            handleFile(files[0]);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto my-12">
            <div
                className={clsx(
                    "relative group cursor-pointer glass-panel rounded-2xl border-2 border-dashed transition-all duration-300 p-12 text-center overflow-hidden",
                    isDragOver ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/50"
                )}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />

                <div className="relative z-10 flex flex-col items-center gap-4">
                    <div className={clsx(
                        "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
                        isProcessing ? "bg-blue-500/20 animate-pulse" : "bg-slate-800 group-hover:bg-blue-500/20"
                    )}>
                        {isProcessing ? (
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        ) : (
                            <Upload className="w-10 h-10 text-slate-400 group-hover:text-blue-400 transition-colors" />
                        )}
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-white group-hover:text-blue-200 transition-colors">
                            {isProcessing ? "Processing Data..." : "Upload CSV File"}
                        </h3>
                        <p className="text-slate-400 text-sm">
                            Drag & drop or click to browse
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
