import React from 'react';
import { LayoutDashboard, LogOut, ExternalLink } from 'lucide-react';

const Navbar = ({ onLogout, showTitle = true }) => {
  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            {showTitle && (
              <div>
                <h1 className="text-lg font-bold text-white">
                  Data Processor
                </h1>
                <p className="text-xs text-slate-400">
                  Admin Dashboard
                </p>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Required URLs - REMOVED */}
            {/* <div className="hidden md:flex items-center gap-2"> ... </div> */}

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
