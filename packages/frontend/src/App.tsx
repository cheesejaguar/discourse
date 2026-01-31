import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import EventPage from './pages/EventPage';
import UserPage from './pages/UserPage';
import SearchPage from './pages/SearchPage';
import CategoryPage from './pages/CategoryPage';

export default function App() {
  const refreshUser = useAuthStore((state) => state.refreshUser);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="event/:eventId" element={<EventPage />} />
        <Route path="user/:userId" element={<UserPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="category/:category" element={<CategoryPage />} />
      </Route>
    </Routes>
  );
}
