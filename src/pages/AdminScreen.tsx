import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConfigStore } from '../store';
import { DashboardRecord, CountryCode, BrandCode } from '../types';
import { HubConfigV1Schema } from '../schemas';
import { ArrowLeft, Plus, Trash2, Edit2, Save, Download, Upload, RefreshCw } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { BmwLogo } from '../components/BmwLogo';

export default function AdminScreen() {
  const navigate = useNavigate();
  const { config, setConfig, addDashboard, updateDashboard, deleteDashboard, resetToDefault } = useConfigStore();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<DashboardRecord>>({});
  const [importError, setImportError] = useState<string | null>(null);

  const handleEdit = (dashboard: DashboardRecord) => {
    setEditingId(dashboard.id);
    setEditForm(dashboard);
  };

  const handleSave = () => {
    if (editingId && editForm.title && editForm.url && editForm.country && editForm.brand) {
      if (editingId === 'new') {
        addDashboard(editForm as Omit<DashboardRecord, 'id'>);
      } else {
        updateDashboard(editingId, editForm);
      }
      setEditingId(null);
      setEditForm({});
    } else {
      alert("Please fill in all required fields (Title, URL, Country, Brand)");
    }
  };

  const handleAddNew = () => {
    setEditingId('new');
    setEditForm({
      country: 'USA',
      brand: 'BMW',
      title: '',
      description: '',
      url: 'https://',
      tags: [],
      isFeatured: false,
    });
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "bmw-hub-config.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const result = HubConfigV1Schema.safeParse(json);
        
        if (result.success) {
          setConfig(result.data);
          setImportError(null);
          alert("Import successful!");
        } else {
          setImportError(result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('\n'));
        }
      } catch (err) {
        setImportError("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#221F1F] font-sans">
      <header className="bg-white px-8 py-6 shadow-sm flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <BmwLogo className="w-8 h-8" />
            <div className="text-2xl font-bold tracking-tighter">Admin Dashboard</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors">
            <Download className="w-4 h-4" /> Export
          </button>
          <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors cursor-pointer">
            <Upload className="w-4 h-4" /> Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button onClick={() => { if(confirm('Reset to default data?')) resetToDefault() }} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-6 py-12">
        {importError && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl whitespace-pre-wrap">
            <h3 className="font-bold mb-2">Import Error</h3>
            {importError}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-xl font-bold">Dashboards ({config.dashboards.length})</h2>
            <button 
              onClick={handleAddNew}
              className="flex items-center gap-2 px-4 py-2 bg-[#1C69D3] text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add New
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-medium">Title</th>
                  <th className="p-4 font-medium">Country</th>
                  <th className="p-4 font-medium">Brand</th>
                  <th className="p-4 font-medium">URL</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {editingId === 'new' && (
                  <tr className="bg-blue-50/50">
                    <td className="p-4" colSpan={5}>
                      <EditForm form={editForm} setForm={setEditForm} onSave={handleSave} onCancel={() => setEditingId(null)} />
                    </td>
                  </tr>
                )}
                
                {config.dashboards.map(dashboard => (
                  <tr key={dashboard.id} className="hover:bg-gray-50 transition-colors">
                    {editingId === dashboard.id ? (
                      <td className="p-4" colSpan={5}>
                        <EditForm form={editForm} setForm={setEditForm} onSave={handleSave} onCancel={() => setEditingId(null)} />
                      </td>
                    ) : (
                      <>
                        <td className="p-4 font-medium">{dashboard.title} {dashboard.isFeatured && <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase">Featured</span>}</td>
                        <td className="p-4 text-sm">{dashboard.country}</td>
                        <td className="p-4 text-sm">{dashboard.brand}</td>
                        <td className="p-4 text-sm truncate max-w-[200px]" title={dashboard.url}>
                          <a href={dashboard.url} target="_blank" rel="noopener noreferrer" className="text-[#1C69D3] hover:underline">{dashboard.url}</a>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => handleEdit(dashboard)} className="p-2 text-gray-400 hover:text-[#1C69D3] hover:bg-blue-50 rounded-lg transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => { if(confirm('Delete this dashboard?')) deleteDashboard(dashboard.id) }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function EditForm({ form, setForm, onSave, onCancel }: { form: Partial<DashboardRecord>, setForm: any, onSave: () => void, onCancel: () => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="col-span-1 md:col-span-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
        <input 
          type="text" 
          value={form.title || ''} 
          onChange={e => setForm({...form, title: e.target.value})}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1C69D3] outline-none"
        />
      </div>
      
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Country *</label>
        <select 
          value={form.country || 'USA'} 
          onChange={e => setForm({...form, country: e.target.value as CountryCode})}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1C69D3] outline-none"
        >
          <option value="USA">USA</option>
          <option value="CANADA">CANADA</option>
          <option value="LATAM">LATAM</option>
        </select>
      </div>
      
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Brand *</label>
        <select 
          value={form.brand || 'BMW'} 
          onChange={e => setForm({...form, brand: e.target.value as BrandCode})}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1C69D3] outline-none"
        >
          <option value="BMW">BMW</option>
          <option value="MINI">MINI</option>
          <option value="MOTORRAD">MOTORRAD</option>
        </select>
      </div>
      
      <div className="col-span-1 md:col-span-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">URL (must start with https://) *</label>
        <input 
          type="url" 
          value={form.url || ''} 
          onChange={e => setForm({...form, url: e.target.value})}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1C69D3] outline-none"
        />
      </div>
      
      <div className="col-span-1 md:col-span-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
        <textarea 
          value={form.description || ''} 
          onChange={e => setForm({...form, description: e.target.value})}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1C69D3] outline-none h-20"
        />
      </div>
      
      <div className="col-span-1 md:col-span-2">
        <label className="block text-xs font-medium text-gray-500 mb-1">Tags (comma separated)</label>
        <input 
          type="text" 
          value={form.tags?.join(', ') || ''} 
          onChange={e => setForm({...form, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
          className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#1C69D3] outline-none"
          placeholder="Sales, Marketing, KPI"
        />
      </div>
      
      <div className="col-span-1 md:col-span-2 flex items-center gap-2 mt-2">
        <input 
          type="checkbox" 
          id="isFeatured"
          checked={form.isFeatured || false} 
          onChange={e => setForm({...form, isFeatured: e.target.checked})}
          className="rounded text-[#1C69D3] focus:ring-[#1C69D3]"
        />
        <label htmlFor="isFeatured" className="text-sm font-medium">Featured Dashboard</label>
      </div>
      
      <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={onSave} className="flex items-center gap-2 px-4 py-2 bg-[#1C69D3] text-white text-sm font-medium hover:bg-blue-700 rounded-lg transition-colors">
          <Save className="w-4 h-4" /> Save Dashboard
        </button>
      </div>
    </div>
  );
}
