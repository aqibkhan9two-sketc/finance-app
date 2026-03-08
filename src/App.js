import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, ArrowUpCircle, ArrowDownCircle, Plus, X, Trash2, 
  Search, Edit3, Briefcase, DollarSign, PlusCircle, Paperclip,
  TrendingUp, TrendingDown, Layers, Wallet, Clock, Download
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [statusUpdateItem, setStatusUpdateItem] = useState(null);
  
  // Search aur Date Filter States [cite: 5, 6]
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [receivables, setReceivables] = useState(() => JSON.parse(localStorage.getItem('rub_v5_rec')) || []);
  const [payables, setPayables] = useState(() => JSON.parse(localStorage.getItem('rub_v5_pay')) || []);

  const initialForm = {
    date: new Date().toISOString().split('T')[0],
    invoiceNo: '', name: '', platform: '', amount: '', paidAmount: '',
    payDate: '', status: 'Unpaid', docs: '',
    providers: [{ vName: '', vAmount: '', vPlatform: '', vService: '' }] 
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    localStorage.setItem('rub_v5_rec', JSON.stringify(receivables));
    localStorage.setItem('rub_v5_pay', JSON.stringify(payables));
  }, [receivables, payables]);

  const calculateOutstanding = (amt, paid) => {
    const res = parseFloat(amt || 0) - parseFloat(paid || 0);
    return res > 0 ? res.toFixed(2) : 0;
  };

  // Global Filter Function jo har jagah apply hogi [cite: 11]
  const getFilteredData = (dataList) => {
    return dataList.filter(item => {
      const matchSearch = (item.name + (item.invoiceNo || '')).toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchDate = true;
      if (startDate && endDate) {
        matchDate = item.date >= startDate && item.date <= endDate;
      } else {
        const itemMonth = item.date.substring(5, 7);
        const itemYear = item.date.substring(0, 4);
        matchDate = itemMonth === filterMonth && itemYear === filterYear;
      }
      return matchSearch && matchDate;
    });
  };

  const filteredRecs = useMemo(() => getFilteredData(receivables), [receivables, searchTerm, startDate, endDate, filterMonth, filterYear]);
  const filteredPays = useMemo(() => getFilteredData(payables), [payables, searchTerm, startDate, endDate, filterMonth, filterYear]);

  // Dashboard Stats update based on filters [cite: 112, 113]
  const dashboardData = useMemo(() => {
    const stats = {
      received: filteredRecs.reduce((a, c) => a + parseFloat(c.paidAmount || 0), 0),
      receivablePending: filteredRecs.reduce((a, c) => a + parseFloat(c.outstanding || 0), 0),
      paid: filteredPays.reduce((a, c) => a + parseFloat(c.paidAmount || 0), 0),
      payablePending: filteredPays.reduce((a, c) => a + parseFloat(c.outstanding || 0), 0),
      pendingRecList: filteredRecs.filter(r => r.status !== 'Paid'),
      pendingPayList: filteredPays.filter(p => p.status !== 'Paid')
    };

    const receivablePie = [
      { name: 'Received', value: stats.received },
      { name: 'Pending', value: stats.receivablePending }
    ];

    const payablePie = [
      { name: 'Paid', value: stats.paid },
      { name: 'Pending', value: stats.payablePending }
    ];

    return { ...stats, receivablePie, payablePie };
  }, [filteredRecs, filteredPays]);

  const COLORS_REC = ['#10b981', '#f59e0b']; 
  const COLORS_PAY = ['#ef4444', '#6366f1'];

  const renderCustomizedLabel = ({ cx, cy, midAngle, outerRadius, name, value }) => {
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 25;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#1e293b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{fontSize: '12px', fontWeight: 'bold'}}>
        {name}: ${value.toLocaleString()}
      </text>
    );
  };

  const handleExportCSV = () => {
    let csvContent = "";
    let fileName = "";

    if (activeTab === 'breakdown') {
      fileName = `Breakdown_Report`;
      const headers = "Date,Invoice,Main Project / Vendors,Platform,Services,Amount / Cost\n";
      let rows = [];
      filteredRecs.forEach(rec => {
        rows.push(`"${rec.date}","${rec.invoiceNo || 'N/A'}","${rec.name}","${rec.platform || '-'}","-","${rec.amount}"`);
        const linked = payables.filter(p => p.linkedRecId === rec.id);
        linked.forEach(p => {
          rows.push(`"","${p.invoiceNo || '-'}","└─ ${p.name}","${p.platform || '-'}","${p.notes || '-'}","${p.amount}"`);
        });
      });
      csvContent = headers + rows.join("\n");
    } else {
      let dataToExport = activeTab === 'payables' ? filteredPays : filteredRecs;
      fileName = activeTab === 'payables' ? `Payables_Report` : `Receivables_Report`;
      const headers = "Date,Invoice,Entity Name,Platform,Amount,Paid,Balance,Status\n";
      const rows = dataToExport.map(i => `"${i.date}","${i.invoiceNo || 'N/A'}","${i.name}","${i.platform || '-'}","${i.amount}","${i.paidAmount || 0}","${i.outstanding}","${i.status}"`);
      csvContent = headers + rows.join("\n");
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.csv`;
    a.click();
  };

  const handleSave = (e) => {
    e.preventDefault();
    const isEdit = !!editingItem;
    const targetId = isEdit ? editingItem.id : Date.now();
    const out = calculateOutstanding(formData.amount, formData.paidAmount);
    const finalData = { ...formData, id: targetId, outstanding: out };

    if (isEdit) {
      if (activeTab === 'receivables') {
        setReceivables(receivables.map(r => r.id === targetId ? finalData : r));
        let updatedPayables = [...payables];
        formData.providers.forEach((pInfo, idx) => {
          if (!pInfo.vName) return;
          const syncKey = `p-${targetId}-${idx}`;
          const existingIndex = updatedPayables.findIndex(p => p.syncKey === syncKey || (p.linkedRecId === targetId && p.name === pInfo.vName));
          if (existingIndex > -1) {
            updatedPayables[existingIndex] = {
              ...updatedPayables[existingIndex],
              invoiceNo: formData.invoiceNo,
              name: pInfo.vName,
              amount: pInfo.vAmount,
              platform: pInfo.vPlatform,
              notes: pInfo.vService,
              date: formData.date,
              outstanding: calculateOutstanding(pInfo.vAmount, updatedPayables[existingIndex].paidAmount)
            };
          } else {
            const newPay = {
              ...initialForm,
              id: Date.now() + idx,
              linkedRecId: targetId,
              syncKey: syncKey,
              date: formData.date,
              invoiceNo: formData.invoiceNo,
              name: pInfo.vName,
              amount: pInfo.vAmount,
              outstanding: pInfo.vAmount,
              platform: pInfo.vPlatform || formData.platform,
              notes: pInfo.vService,
              status: 'Unpaid'
            };
            updatedPayables.push(newPay);
          }
        });
        setPayables(updatedPayables);
      } else {
        setPayables(payables.map(p => p.id === targetId ? finalData : p));
      }
    } else {
      if (activeTab === 'receivables') {
        setReceivables([...receivables, finalData]);
        if (formData.providers.some(p => p.vName)) {
          const autoPays = formData.providers.filter(p => p.vName).map((p, i) => ({
            ...initialForm, 
            id: targetId + i + 1, 
            linkedRecId: targetId, 
            syncKey: `p-${targetId}-${i}`,
            date: formData.date,
            invoiceNo: formData.invoiceNo,
            name: p.vName, 
            amount: p.vAmount, 
            outstanding: p.vAmount, 
            platform: p.vPlatform || formData.platform,
            notes: p.vService
          }));
          setPayables([...payables, ...autoPays]);
        }
      } else setPayables([...payables, finalData]);
    }
    closeModal();
  };

  const handleQuickUpdate = (e) => {
    e.preventDefault();
    const out = calculateOutstanding(statusUpdateItem.amount, statusUpdateItem.paidAmount);
    const updated = { ...statusUpdateItem, outstanding: out };
    if (activeTab === 'receivables') setReceivables(receivables.map(r => r.id === updated.id ? updated : r));
    else setPayables(payables.map(p => p.id === updated.id ? updated : p));
    setStatusUpdateItem(null);
  };

  const closeModal = () => { setShowModal(false); setEditingItem(null); setFormData(initialForm); };

  // Styles
  const sidebarStyle = { width: '260px', background: '#0f172a', color: 'white', position: 'fixed', height: '100vh', left: 0, top: 0, boxShadow: '4px 0 15px rgba(0,0,0,0.1)' };
  const sidebarItem = (active) => ({ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px', cursor: 'pointer', borderRadius: '12px', margin: '8px 0', transition: '0.3s', background: active ? 'linear-gradient(90deg, #6366f1, #4f46e5)' : 'transparent', color: active ? 'white' : '#94a3b8', fontWeight: active ? '700' : '500' });
  const logoStyle = { padding: '35px 25px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '20px', fontWeight: '900', color: 'white', borderBottom: '1px solid rgba(255,255,255,0.05)' };
  const logoIcon = { background: '#6366f1', padding: '8px', borderRadius: '10px' };
  const headerStyle = { background: 'white', padding: '20px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position:'sticky', top:0, zIndex:10 };
  const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px', marginBottom: '40px' };
  const glassCard = (color, bg) => ({ background: 'white', padding: '24px', borderRadius: '24px', border: `1px solid #f1f5f9`, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', position: 'relative', overflow: 'hidden' });
  const iconBadge = (col) => ({ background: `${col}15`, color: col, width: '45px', height: '45px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '15px' });
  const cardLabel = { color: '#64748b', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' };
  const cardValue = { fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '8px' };
  const chartGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' };
  const chartBox = { background: 'white', padding: '30px', borderRadius: '24px', border: '1px solid #f1f5f9' };
  const chartTitle = { margin: '0 0 25px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' };
  const tableContainer = { background: 'white', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden' };
  const mainTable = { width: '100%', borderCollapse: 'collapse', textAlign: 'center' };
  const thS = { padding: '18px', background: '#f8fafc', color: '#64748b', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase' };
  const thS_Left = { ...thS, textAlign: 'left' };
  const tdS = { padding: '18px', borderBottom: '1px solid #f1f5f9', fontSize: '14px', color: '#1e293b' };
  const tdS_Left = { ...tdS, textAlign: 'left' };
  const tdS_Left_Indented = { ...tdS, textAlign: 'left', paddingLeft: '40px' };
  const thRowDark = { background: '#f8fafc' };
  const trS = { transition: '0.2s' };
  const invBadge = { background: '#f1f5f9', color: '#475569', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' };
  const primaryBtn = { display: 'flex', alignItems: 'center', gap: '8px', background: '#6366f1', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', transition: '0.3s' };
  const searchWrapper = { display: 'flex', alignItems: 'center', gap: '10px', background: '#f1f5f9', padding: '10px 15px', borderRadius: '12px', width: '250px' };
  const searchInput = { background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', width: '100%', color: '#1e293b' };
  const filterGroup = { display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '12px', border:'1px solid #e2e8f0' };
  const cleanInp = { background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: '#475569', fontWeight: '600', cursor:'pointer' };
  const statusTag = (s) => ({ padding: '6px 12px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', cursor:'pointer', background: s==='Paid' ? '#ecfdf5' : (s==='Unpaid'?'#fef2f2':'#fffbeb'), color: s==='Paid' ? '#10b981' : (s==='Unpaid'?'#ef4444':'#f59e0b') });
  const transactionDataBox = { marginTop: '25px', padding: '20px', background: '#f8fafc', borderRadius: '16px' };
  const smallTitle = { margin: '0 0 15px 0', fontSize: '13px', fontWeight: '700', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' };
  const miniScrollList = { maxHeight: '150px', overflowY: 'auto' };
  const miniItem = { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #e2e8f0', fontSize: '13px' };
  const emptyMsg = { textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '10px' };
  const saveBtn = { width:'100%', marginTop:'20px', background: '#6366f1', color: 'white', border: 'none', padding: '15px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700' };
  const iconBtn = (bg, col) => ({ background: bg, color: col, border:'none', padding:'8px', borderRadius:'8px', cursor:'pointer' });
  const docLink = { color:'#6366f1', background:'#eef2ff', padding:'5px', borderRadius:'5px', display:'inline-flex' };
  const modalOverlay = { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(15, 23, 42, 0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' };
  const modalBox = { background: 'white', padding: '40px', borderRadius: '24px', width: '700px', maxHeight:'90vh', overflowY:'auto' };
  const modalHead = { display: 'flex', justifyContent: 'space-between', marginBottom: '30px' };
  const formGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' };
  const inpGroup = { display: 'flex', flexDirection: 'column', gap: '8px' }; 
  const lbl = { fontSize: '13px', fontWeight: '600', color: '#475569' };
  const inp = { width: '100%', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', outline: 'none', fontSize:'14px', boxSizing: 'border-box' };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Sidebar */}
      <div style={sidebarStyle}>
        <div style={logoStyle}>
          <div style={logoIcon}><DollarSign size={24}/></div>
          <span style={{letterSpacing:'-0.5px'}}>RUBELLE</span>
        </div>
        <nav style={{ marginTop: '30px', padding: '0 15px' }}>
          <div onClick={() => setActiveTab('dashboard')} style={sidebarItem(activeTab === 'dashboard')}><LayoutDashboard size={20}/> Dashboard</div>
          <div onClick={() => setActiveTab('receivables')} style={sidebarItem(activeTab === 'receivables')}><TrendingUp size={20}/> Receivables</div>
          <div onClick={() => setActiveTab('payables')} style={sidebarItem(activeTab === 'payables')}><TrendingDown size={20}/> Payables</div>
          <div onClick={() => setActiveTab('breakdown')} style={sidebarItem(activeTab === 'breakdown')}><Layers size={20}/> Breakdown</div>
        </nav>
      </div>

      <div style={{ flex: 1, marginLeft: '260px' }}>
        <div style={headerStyle}>
          <div>
             <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin:0 }}>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h2>
             <p style={{fontSize:'12px', color:'#64748b', margin:0}}>Filtered View</p>
          </div>
          
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <div style={filterGroup}>
              <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)} style={cleanInp}>
                {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span style={{color:'#cbd5e1'}}>|</span>
              <select value={filterYear} onChange={e=>setFilterYear(e.target.value)} style={cleanInp}>
                {['2023','2024','2025','2026'].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <div style={filterGroup}>
                <span style={{fontSize:'11px', color:'#64748b'}}>From:</span>
                <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={cleanInp}/>
                <span style={{fontSize:'11px', color:'#64748b'}}>To:</span>
                <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} style={cleanInp}/>
            </div>
            
            <div style={searchWrapper}>
                <Search size={16} color="#94a3b8"/>
                <input placeholder="Search records..." style={searchInput} value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)}/>
            </div>

            <button onClick={handleExportCSV} style={{...primaryBtn, background:'#10b981', marginLeft:'5px'}} title="Export Data">
                <Download size={16}/> Export
            </button>
          </div>
        </div>

        <div style={{ padding: '30px' }}>
          {activeTab === 'dashboard' && (
            <div>
              <div style={statsGrid}>
                <div style={glassCard('#10b981', '#ecfdf5')}>
                   <div style={iconBadge('#10b981')}><ArrowUpCircle size={20}/></div>
                   <span style={cardLabel}>Total Received</span>
                   <h3 style={cardValue}>${dashboardData.received.toLocaleString()}</h3>
                </div>
                <div style={glassCard('#f59e0b', '#fffbeb')}>
                   <div style={iconBadge('#f59e0b')}><Wallet size={20}/></div>
                   <span style={cardLabel}>Pending Receivable</span>
                   <h3 style={cardValue}>${dashboardData.receivablePending.toLocaleString()}</h3>
                </div>
                <div style={glassCard('#ef4444', '#fef2f2')}>
                   <div style={iconBadge('#ef4444')}><ArrowDownCircle size={20}/></div>
                   <span style={cardLabel}>Total Paid</span>
                   <h3 style={cardValue}>${dashboardData.paid.toLocaleString()}</h3>
                </div>
                <div style={glassCard('#6366f1', '#eef2ff')}>
                   <div style={iconBadge('#6366f1')}><Briefcase size={20}/></div>
                   <span style={cardLabel}>Outstanding Payable</span>
                   <h3 style={cardValue}>${dashboardData.payablePending.toLocaleString()}</h3>
                </div>
              </div>
              
              <div style={chartGrid}>
                <div style={chartBox}>
                  <h4 style={chartTitle}>Receivable Analysis</h4>
                  <div style={{height:'320px'}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dashboardData.receivablePie} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none" label={renderCustomizedLabel} >
                          {dashboardData.receivablePie.map((entry, index) => ( <Cell key={`cell-rec-${index}`} fill={COLORS_REC[index % COLORS_REC.length]} /> ))}
                        </Pie>
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={transactionDataBox}>
                    <h5 style={smallTitle}><Clock size={14}/> Pending to Receive</h5>
                    <div style={miniScrollList}>
                      {dashboardData.pendingRecList.length > 0 ? dashboardData.pendingRecList.map(item => (
                        <div key={item.id} style={miniItem}>
                          <span style={{fontWeight:600}}>{item.name}</span>
                          <span style={{color:'#f59e0b', fontWeight:700}}>${item.outstanding}</span>
                        </div>
                      )) : <div style={emptyMsg}>No pending receivables</div>}
                    </div>
                  </div>
                </div>

                <div style={chartBox}>
                  <h4 style={chartTitle}>Payable Analysis</h4>
                  <div style={{height:'320px'}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dashboardData.payablePie} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none" label={renderCustomizedLabel} >
                          {dashboardData.payablePie.map((entry, index) => ( <Cell key={`cell-pay-${index}`} fill={COLORS_PAY[index % COLORS_PAY.length]} /> ))}
                        </Pie>
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                        <Legend verticalAlign="bottom" height={36}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={transactionDataBox}>
                    <h5 style={smallTitle}><TrendingDown size={14}/> Pending to Pay</h5>
                    <div style={miniScrollList}>
                      {dashboardData.pendingPayList.length > 0 ? dashboardData.pendingPayList.map(item => (
                        <div key={item.id} style={miniItem}>
                          <span style={{fontWeight:600}}>{item.name}</span>
                          <span style={{color:'#6366f1', fontWeight:700}}>${item.outstanding}</span>
                        </div>
                      )) : <div style={emptyMsg}>No pending payables</div>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'receivables' || activeTab === 'payables') && (
            <div style={tableContainer}>
              <div style={{padding:'25px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f1f5f9'}}>
                <div>
                    <h3 style={{margin:0, fontSize:'16px', fontWeight:700}}>Transaction History</h3>
                    <span style={{fontSize:'12px', color:'#94a3b8'}}>Manage your {activeTab} records.</span>
                </div>
                <button onClick={() => setShowModal(true)} style={primaryBtn}><Plus size={18}/> New Entry</button>
              </div>
              <div style={{overflowX:'auto'}}>
                <table style={mainTable}>
                  <thead>
                    <tr style={thRowDark}>
                      <th style={thS}>Date</th>
                      <th style={thS}>Invoice</th>
                      <th style={thS_Left}>Entity Name</th>
                      <th style={thS}>Platform</th>
                      <th style={thS}>Amount</th>
                      <th style={thS}>Paid</th>
                      <th style={thS}>Balance</th>
                      <th style={thS}>Status</th>
                      <th style={thS}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(activeTab === 'receivables' ? filteredRecs : filteredPays).map(item => (
                      <tr key={item.id} style={trS}>
                        <td style={tdS}>{item.date}</td>
                        <td style={tdS}><span style={invBadge}>{item.invoiceNo || 'N/A'}</span></td>
                        <td style={tdS_Left}><b>{item.name}</b></td>
                        <td style={tdS}>{item.platform || '-'}</td>
                        <td style={tdS}>${item.amount}</td>
                        <td style={tdS}>${item.paidAmount || 0}</td>
                        <td style={{...tdS, color: item.outstanding > 0 ? '#ef4444' : '#10b981', fontWeight:'700'}}>${item.outstanding}</td>
                        <td style={tdS}><span onClick={()=>setStatusUpdateItem(item)} style={statusTag(item.status)}>{item.status}</span></td>
                        <td style={tdS}>
                          <div style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                            <button onClick={()=>{setEditingItem(item); setFormData(item); setShowModal(true);}} style={iconBtn('#f1f5f9', '#64748b')}><Edit3 size={14}/></button>
                            <button onClick={()=>{ const fn = activeTab === 'receivables' ? setReceivables : setPayables; if(window.confirm('Are you sure?')) fn(prev => prev.filter(x => x.id !== item.id)); }} style={iconBtn('#fef2f2', '#ef4444')}><Trash2 size={14}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'breakdown' && (
            <div style={tableContainer}>
              <table style={mainTable}>
                <thead>
                  <tr style={thRowDark}>
                    <th style={thS}>Date</th>
                    <th style={thS}>Invoice</th>
                    <th style={thS_Left}>Main Project / Vendors</th>
                    <th style={thS}>Platform</th>
                    <th style={thS}>Services</th>
                    <th style={thS}>Amount / Cost</th>
                    <th style={thS}>Docs</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecs.map(rec => {
                    const linked = payables.filter(p => p.linkedRecId === rec.id);
                    return (
                      <React.Fragment key={rec.id}>
                        <tr style={{background:'#fcfcfc', fontWeight:'bold'}}>
                          <td style={tdS}>{rec.date}</td>
                          <td style={tdS}><span style={invBadge}>{rec.invoiceNo || 'N/A'}</span></td>
                          <td style={tdS_Left}>
                            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                              <div style={{width:'8px', height:'8px', borderRadius:'50%', background:'#6366f1'}}></div>
                              {rec.name}
                            </div>
                          </td>
                          <td style={tdS}>{rec.platform || '-'}</td>
                          <td style={tdS}>-</td>
                          <td style={tdS}>${rec.amount}</td>
                          <td style={tdS}> {rec.docs ? <a href={rec.docs} target="_blank" rel="noreferrer" style={docLink}><Paperclip size={14}/></a> : '-'} </td>
                        </tr>
                        {linked.map(p => (
                          <tr key={p.id} style={{fontSize:'12px', color:'#64748b', background:'#fff'}}>
                            <td style={tdS}></td>
                            <td style={tdS}><span style={invBadge}>{p.invoiceNo || '-'}</span></td>
                            <td style={tdS_Left_Indented}> <span style={{color:'#cbd5e1', marginRight:'10px'}}>└─</span> {p.name} </td>
                            <td style={tdS}>{p.platform || '-'}</td>
                            <td style={tdS}>{p.notes || '-'}</td>
                            <td style={tdS}>${p.amount}</td>
                            <td style={tdS}> {p.docs ? <a href={p.docs} target="_blank" rel="noreferrer" style={docLink}><Paperclip size={12}/></a> : '-'} </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={modalHead}>
              <h2 style={{fontSize:'22px', fontWeight:'800', color:'#0f172a'}}>{editingItem ? 'Edit Entry' : 'Create New Entry'}</h2>
              <X size={24} onClick={closeModal} style={{cursor:'pointer', color:'#64748b'}}/>
            </div>
            <form onSubmit={handleSave}>
               <div style={formGrid}>
                  <div style={inpGroup}><label style={lbl}>Date</label><input type="date" style={inp} value={formData.date} onChange={e=>setFormData({...formData, date: e.target.value})} required/></div>
                  <div style={inpGroup}><label style={lbl}>Invoice No</label><input style={inp} value={formData.invoiceNo} onChange={e=>setFormData({...formData, invoiceNo: e.target.value})}/></div>
                  <div style={inpGroup}><label style={lbl}>Entity/Project Name</label><input style={inp} value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} required/></div>
                  <div style={inpGroup}><label style={lbl}>Platform</label><input style={inp} value={formData.platform} onChange={e=>setFormData({...formData, platform: e.target.value})}/></div>
                  <div style={inpGroup}><label style={lbl}>Total Amount ($)</label><input type="number" style={inp} value={formData.amount} onChange={e=>setFormData({...formData, amount: e.target.value})} required/></div>
                  <div style={inpGroup}><label style={lbl}>Paid Amount ($)</label><input type="number" style={inp} value={formData.paidAmount} onChange={e=>setFormData({...formData, paidAmount: e.target.value})}/></div>
                  <div style={inpGroup}><label style={lbl}>Payment Date</label><input type="date" style={inp} value={formData.payDate} onChange={e=>setFormData({...formData, payDate: e.target.value})}/></div>
                  <div style={inpGroup}><label style={lbl}>Status</label><select style={inp} value={formData.status} onChange={e=>setFormData({...formData, status: e.target.value})}><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option><option value="Partially">Partially</option></select></div>
                  <div style={{gridColumn:'span 2', ...inpGroup}}><label style={lbl}>Docs/Link</label><input style={inp} value={formData.docs} onChange={e=>setFormData({...formData, docs: e.target.value})}/></div>
               </div>
               {activeTab === 'receivables' && (
                 <div style={{marginTop:'30px'}}>
                   <h4 style={{fontSize:'14px', fontWeight:'700', color:'#475569', marginBottom:'15px'}}>Vendor/Payable Breakdown</h4>
                   {formData.providers.map((p, i) => (
                     <div key={i} style={{display:'grid', gridTemplateColumns:'2fr 1fr 1fr 2fr 40px', gap:'10px', marginBottom:'10px'}}>
                        <input placeholder="Vendor Name" style={inp} value={p.vName} onChange={e => { const vendors = [...formData.providers]; vendors[i].vName = e.target.value; setFormData({...formData, providers: vendors}); }}/>
                        <input placeholder="Cost ($)" style={inp} type="number" value={p.vAmount} onChange={e => { const vendors = [...formData.providers]; vendors[i].vAmount = e.target.value; setFormData({...formData, providers: vendors}); }}/>
                        <input placeholder="Platform" style={inp} value={p.vPlatform} onChange={e => { const vendors = [...formData.providers]; vendors[i].vPlatform = e.target.value; setFormData({...formData, providers: vendors}); }}/>
                        <input placeholder="Service/Note" style={inp} value={p.vService} onChange={e => { const vendors = [...formData.providers]; vendors[i].vService = e.target.value; setFormData({...formData, providers: vendors}); }}/>
                        <button type="button" onClick={() => { const vendors = formData.providers.filter((_, idx) => idx !== i); setFormData({...formData, providers: vendors}); }} style={iconBtn('#fef2f2', '#ef4444')}><Trash2 size={14}/></button>
                     </div>
                   ))}
                   <button type="button" onClick={() => setFormData({...formData, providers: [...formData.providers, {vName:'', vAmount:'', vPlatform:'', vService:''}]})} style={{...primaryBtn, background:'#eef2ff', color:'#6366f1', marginTop:'10px'}}><PlusCircle size={16}/> Add Vendor</button>
                 </div>
               )}
               <button type="submit" style={saveBtn}>{editingItem ? 'Save Changes' : 'Create Entry'}</button>
            </form>
          </div>
        </div>
      )}

      {statusUpdateItem && (
        <div style={modalOverlay}>
          <div style={{...modalBox, width: '400px'}}>
            <div style={modalHead}><h3>Update Payment</h3><X size={20} onClick={()=>setStatusUpdateItem(null)} style={{cursor:'pointer'}}/></div>
            <form onSubmit={handleQuickUpdate}>
              <div style={{marginBottom:'20px'}}><label style={lbl}>Status</label><select style={inp} value={statusUpdateItem.status} onChange={e=>setStatusUpdateItem({...statusUpdateItem, status: e.target.value})}><option value="Unpaid">Unpaid</option><option value="Paid">Paid</option><option value="Partially">Partially</option></select></div>
              <div style={{marginBottom:'20px'}}><label style={lbl}>Paid Amount ($)</label><input style={inp} type="number" value={statusUpdateItem.paidAmount} onChange={e=>setStatusUpdateItem({...statusUpdateItem, paidAmount: e.target.value})}/></div>
              <div style={{marginBottom:'20px'}}><label style={lbl}>Payment Date</label><input style={inp} type="date" value={statusUpdateItem.payDate} onChange={e=>setStatusUpdateItem({...statusUpdateItem, payDate: e.target.value})}/></div>
              <button type="submit" style={saveBtn}>Confirm Changes</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}