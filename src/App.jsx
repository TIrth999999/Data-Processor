import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import FileUpload from './components/FileUpload';
import DataTable from './components/DataTable';
import EnrichmentPanel from './components/EnrichmentPanel';
import Navbar from './components/Navbar';
import Papa from 'papaparse';
import { LayoutDashboard, Download, CheckCircle, XCircle, AlertTriangle, ArrowRight, LogOut } from 'lucide-react';
import { clsx } from 'clsx';

const App = () => {
  // Persistence Initialization
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('csc_isLoggedIn') === 'true';
  });

  const [data, setData] = useState(() => {
    const saved = localStorage.getItem('csc_data');
    return saved ? JSON.parse(saved) : null;
  });

  const [filter, setFilter] = useState('All');
  const [appStep, setAppStep] = useState('verification'); // verification | enrichment

  // Persistence Effects
  useEffect(() => {
    localStorage.setItem('csc_isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    if (data) {
      localStorage.setItem('csc_data', JSON.stringify(data));
    } else {
      localStorage.removeItem('csc_data');
    }
  }, [data]);

  const handleAction = (id, action) => {
    setData(prev => prev.map(row => {
      if (row.id === id) {
        if (action === 'Approve') {
          return {
            ...row,
            internalStatus: 'Approved',
            statusColor: 'bg-green-500/20 text-green-300 border-green-500/50'
          };
        } else if (action === 'Reject') {
          return {
            ...row,
            internalStatus: 'Rejected',
            statusColor: 'bg-red-500/20 text-red-300 border-red-500/50'
          };
        }
      }
      return row;
    }));
  };

  const handleReset = () => {
    if (confirm("Are you sure? This will clear all data.")) {
      setData(null);
      localStorage.removeItem('csc_data');
      setAppStep('verification');
    }
  }

  const exportCSV = () => {
    if (!data) return;
    const exportData = data.map(row => ({
      ...row.originalRow,
      "Processing Status": row.internalStatus
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'processed_csc_data.csv';
    link.click();
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setData(null);
    setAppStep('verification');
    localStorage.removeItem('csc_isLoggedIn');
    localStorage.removeItem('csc_data');
  };

  if (!isLoggedIn) {
    return <Login onLogin={setIsLoggedIn} />;
  }

  if (appStep === 'enrichment' && data) {
    const approvedData = data.filter(d => d.internalStatus === 'Approved');

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navbar onLogout={handleLogout} />
        <div className="p-6 md:p-8">
          <EnrichmentPanel
            data={approvedData}
            onUpdateData={(updatedSubset) => {
              const updateMap = new Map(updatedSubset.map(d => [d.id, d]));
              setData(prev => prev.map(row => updateMap.get(row.id) || row));
            }}
            onBack={() => setAppStep('verification')}
            onLogout={handleLogout}
          />
        </div>
      </div>
    )
  }

  const filteredData = data
    ? data.filter(r => filter === 'All' ? true : r.internalStatus === filter)
    : [];

  const counts = data ? {
    All: data.length,
    Approved: data.filter(r => r.internalStatus === 'Approved').length,
    Review: data.filter(r => r.internalStatus === 'Review').length,
    Rejected: data.filter(r => r.internalStatus === 'Rejected').length,
  } : { All: 0, Approved: 0, Review: 0, Rejected: 0 };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar onLogout={handleLogout} />
      <div className="p-6 md:p-8">
        {/* Header Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          {data && (
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={handleReset} 
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all text-red-400 border border-red-500/20 hover:bg-red-500/10"
              >
                Reset Data
              </button>
              <button
                onClick={() => setAppStep('enrichment')}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Proceed Further</span>
              </button>
            </div>
          )}
        </div>

        {!data ? (
          <FileUpload onDataProcessed={setData} />
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Records', value: counts.All, color: 'text-slate-200', icon: LayoutDashboard, filter: 'All' },
                { label: 'Approved', value: counts.Approved, color: 'text-green-400', icon: CheckCircle, filter: 'Approved' },
                { label: 'Pending Review', value: counts.Review, color: 'text-amber-400', icon: AlertTriangle, filter: 'Review' },
                { label: 'Rejected', value: counts.Rejected, color: 'text-red-400', icon: XCircle, filter: 'Rejected' },
              ].map((stat) => (
                <button
                  key={stat.label}
                  onClick={() => setFilter(stat.filter)}
                  className={clsx(
                    "p-4 rounded-xl text-left border-l-4 transition-all glass-card",
                    filter === stat.filter && 'bg-slate-800',
                    stat.filter === 'Review' ? 'border-amber-500' :
                      stat.filter === 'Approved' ? 'border-green-500' :
                        stat.filter === 'Rejected' ? 'border-red-500' : 'border-blue-500'
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                    <stat.icon className={`w-5 h-5 ${stat.color} opacity-80`} />
                  </div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </button>
              ))}
            </div>

            <DataTable data={filteredData} onAction={handleAction} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
