import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClientContext } from '../../hooks/useClientContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { selectedClient, clearSelectedClient } = useClientContext();
  const location = useLocation();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isClientMode = isAdmin && selectedClient !== null;

  const isActive = (path: string) => location.pathname === path;

  // Global view nav items (for clients or admin without selected client)
  const globalNavItems = isAdmin
    ? [
        { path: '/', label: 'ホーム' },
        { path: '/clients', label: '顧問先' },
        { path: '/chat', label: 'AI相談' },
      ]
    : [
        { path: '/', label: 'ホーム' },
        { path: '/upload', label: '領収書' },
        { path: '/documents', label: '基礎資料' },
        { path: '/chat', label: 'AI相談' },
      ];

  // Client view nav items (admin with selected client)
  const clientNavItems = [
    { path: '/client/dashboard', label: 'ダッシュボード' },
    { path: '/client/review', label: '審核' },
    { path: '/client/documents', label: '基礎資料' },
    { path: '/client/transactions', label: '取引一覧' },
  ];

  const navItems = isClientMode ? clientNavItems : globalNavItems;

  function handleBackToGlobal() {
    clearSelectedClient();
    navigate('/clients');
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isClientMode ? (
            <>
              <button
                onClick={handleBackToGlobal}
                className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline text-sm">戻る</span>
              </button>
              <div className="h-6 w-px bg-gray-300" />
              <h1 className="text-lg font-bold text-primary-600 truncate max-w-[200px]">
                {selectedClient.name}
              </h1>
            </>
          ) : (
            <>
              <button
                onClick={() => navigate('/')}
                className="text-xl font-bold text-primary-600 hover:text-primary-700"
              >
                Tax Pre-Process
              </button>
              {isAdmin && (
                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">
                  管理者
                </span>
              )}
            </>
          )}
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'text-primary-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          {isClientMode && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-green-600">{selectedClient.confirmed_count}確認済</span>
              <span className="text-gray-400">/</span>
              <span className="text-orange-600">{selectedClient.pending_count}要確認</span>
            </div>
          )}
          <span className="text-sm text-gray-600">{user?.name}</span>
          <button
            onClick={() => navigate('/settings')}
            className="text-gray-500 hover:text-gray-700"
            title="設定"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ログアウト
          </button>
        </div>
      </div>
    </header>
  );
}
