
import React, { useState } from 'react';
import { clsx } from 'clsx';
import { Check, X, Eye, ExternalLink, ShieldAlert } from 'lucide-react';

const DataTable = ({ data, onAction }) => {
    const [selectedRow, setSelectedRow] = useState(null);

    // Helper to find relevant link columns
    const getLinkColumns = (row) => {
        return Object.keys(row).filter(key =>
            row[key] && typeof row[key] === 'string' && row[key].startsWith('http')
        );
    };

    const getCellContent = (row, key) => {
        // Find Name, Mobile, Birth Place
        // We'll normalize in render
    };

    // Headers mapping - dynamic based on first data row or specific subset?
    // User wants "filteration" and specific fields.
    // Let's rely on the first row to determine headers, but prioritize Name, Birth, Mobile, Status

    // NOTE: For the dashboard table, we stick to the main columns for cleanliness.
    // Key mapping logic for "T&C" header
    const getHeaderName = (key) => {
        if (key.length > 50 && key.toLowerCase().includes("term")) return "T&C";
        return key;
    };

    return (
        <>
            <div className="glass-panel rounded-xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-900/80 border-b border-slate-700 text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-medium">Student Name</th>
                                <th className="p-4 font-medium">Birth Place</th>
                                <th className="p-4 font-medium">Mobile</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {data.map((row) => {
                                const nameKey = Object.keys(row).find(k => k.includes("Name of Student (Full Name)")) || "Name";
                                const mobileKey = Object.keys(row).find(k => k.includes("Mobile Number")) || "Mobile";
                                const birthKey = Object.keys(row).find(k => k.includes("Birth Place")) || "Birth Place";

                                return (
                                    <tr
                                        key={row.id}
                                        className={clsx(
                                            "group transition-colors duration-200 hover:bg-slate-800/40",
                                            row.internalStatus === 'Review' && "bg-amber-900/10 hover:bg-amber-900/20"
                                        )}
                                    >
                                        <td className="p-4 font-medium text-slate-200">
                                            {row[nameKey] || "N/A"}
                                        </td>
                                        <td className="p-4 text-slate-400 max-w-xs truncate" title={row[birthKey]}>
                                            {row[birthKey] || "N/A"}
                                        </td>
                                        <td className="p-4 text-slate-400 font-mono">
                                            {row[mobileKey] || "N/A"}
                                        </td>
                                        <td className="p-4">
                                            <span className={clsx(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border",
                                                row.statusColor
                                            )}>
                                                {row.internalStatus === 'Review' && <ShieldAlert className="w-3 h-3" />}
                                                {row.internalStatus}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-2">
                                            {row.internalStatus === 'Review' && (
                                                <>
                                                    <button
                                                        onClick={() => onAction(row.id, 'Approve')}
                                                        className="p-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 hover:scale-110 transition-all"
                                                        title="Approve"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onAction(row.id, 'Reject')}
                                                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:scale-110 transition-all"
                                                        title="Reject"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}

                                            <button
                                                onClick={() => setSelectedRow(row)}
                                                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:scale-110 transition-all"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {data.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        No data found.
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedRow && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="glass-panel w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 p-6 relative">
                        <button
                            onClick={() => setSelectedRow(null)}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold mb-6 text-white border-b border-slate-800 pb-4">
                            Student Details
                        </h2>

                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                {Object.entries(selectedRow).map(([key, value]) => {
                                    if (['id', 'internalStatus', 'statusColor', 'originalRow'].includes(key)) return null;
                                    if (typeof value === 'string' && value.startsWith('http')) return null; // Hide links here

                                    // Truncate long T&C values in display
                                    const isTC = key.length > 50 && key.toLowerCase().includes("term");
                                    const displayVal = isTC ? "Agreed" : value;
                                    const displayKey = isTC ? "T&C" : key;

                                    return (
                                        <div key={key} className="space-y-1">
                                            <dt className="text-xs text-slate-500 uppercase truncate" title={key}>{displayKey}</dt>
                                            <dd className="text-sm text-slate-200 font-medium break-words bg-slate-800/50 p-2 rounded border border-slate-700/50">{displayVal}</dd>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                <h3 className="font-semibold text-slate-300">Attached Documents</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {Object.keys(selectedRow).filter(k => selectedRow[k] && typeof selectedRow[k] === 'string' && selectedRow[k].startsWith('http')).map((key) => (
                                        <a
                                            key={key}
                                            href={selectedRow[key]}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all group"
                                        >
                                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 group-hover:text-white transition-colors">
                                                <ExternalLink className="w-5 h-5" />
                                            </div>
                                            <span className="text-sm font-medium text-slate-300 group-hover:text-white truncate" title={key}>
                                                {key}
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-slate-800">
                            {selectedRow.internalStatus === 'Review' && (
                                <>
                                    <button
                                        onClick={() => { onAction(selectedRow.id, 'Reject'); setSelectedRow(null); }}
                                        className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 transition-all font-medium"
                                    >
                                        Reject Application
                                    </button>
                                    <button
                                        onClick={() => { onAction(selectedRow.id, 'Approve'); setSelectedRow(null); }}
                                        className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20 rounded-lg transition-all font-medium"
                                    >
                                        Approve Application
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setSelectedRow(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default DataTable;
