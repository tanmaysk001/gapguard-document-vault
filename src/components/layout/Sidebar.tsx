import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  ClipboardList
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Documents', href: '/documents', icon: FileText },
  { name: 'Rules', href: '/rules', icon: ClipboardList },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${
      collapsed ? 'w-16' : 'w-64'
    }`}>
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {!collapsed && (
            <span className="text-lg font-semibold text-gray-900">Navigation</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <item.icon className={`h-5 w-5 ${collapsed ? 'mx-auto' : 'mr-3'}`} />
                {!collapsed && item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
