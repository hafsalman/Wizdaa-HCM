import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { RequestsPage } from './pages/RequestsPage';
import { HolidaysPage } from './pages/HolidaysPage';
import { LoginPage } from './pages/LoginPage';
import './index.css';

function App() {
  const token = localStorage.getItem('token');

  if (!token) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/requests" element={<RequestsPage />} />
          <Route path="/holidays" element={<HolidaysPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
