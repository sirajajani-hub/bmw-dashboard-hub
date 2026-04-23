/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BrandSelection from './pages/BrandSelection';
import DashboardSelection from './pages/DashboardSelection';
import AdminScreen from './pages/AdminScreen';
import DashboardShell from './pages/DashboardShell';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/brand" replace />} />
        <Route path="/brand" element={<BrandSelection />} />
        <Route path="/dashboards" element={<DashboardSelection />} />
        <Route path="/dashboards/shell" element={<DashboardShell />} />
        <Route path="/admin" element={<AdminScreen />} />
      </Routes>
    </Router>
  );
}
