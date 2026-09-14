
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Pill, ShoppingBag, FileText, Bell, User, ShieldAlert } from 'lucide-react';

const Sidebar = () => {
  const { user } = useAuth();

  const getLinks = () => {
    if (!user) return [];

    switch (user.role) {
      case 'superadmin':
        return [
          { name: 'User Control Panel', path: '/superadmin', icon: Users },
          { name: 'Inventory Manager', path: '/pharmacist', icon: Pill },
        ];
      case 'pharmacist':
        return [{ name: 'Inventory Manager', path: '/pharmacist', icon: Pill }];
      case 'customer':
        return [
          { name: 'Dashboard', path: '/customer/dashboard', icon: LayoutDashboard },
          { name: 'Medicine Shop', path: '/customer/shop', icon: ShoppingBag },
          { name: 'Invoice History', path: '/customer/bills', icon: FileText },
          { name: 'Medication Reminders', path: '/customer/reminders', icon: Bell },
          { name: 'My Profile', path: '/customer/profile', icon: User },
        ];
      default:
        return [];
    }
  };

  const links = getLinks();
  const portalLabel = user?.role === 'superadmin' ? 'Superadmin Portal' : user?.role === 'pharmacist' ? 'Pharmacist Portal' : 'Customer Portal';

  return (
    <>
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 md:flex">
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 px-3 py-3 dark:border-teal-800/60 dark:from-slate-800 dark:to-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-emerald-500 text-white shadow-sm shadow-teal-500/20">
            <Pill className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900 dark:text-slate-50">Sardar Medical Store</div>
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-300">{portalLabel}</div>
          </div>
        </div>

        <div className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300">Navigation</div>
        <div className="flex-1 space-y-1.5">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'border-teal-600 bg-gradient-to-r from-teal-600 to-emerald-500 text-white shadow-sm shadow-teal-600/20'
                      : 'border-transparent text-slate-600 hover:bg-teal-50 hover:text-teal-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{link.name}</span>
              </NavLink>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-300">
            <ShieldAlert className="h-4 w-4" />
            <span>Status Shield</span>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
            Logged in session is secured with dual access and refresh token rotation.
          </p>
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-14 items-center justify-around border-t border-slate-200 bg-white/95 px-1 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95 md:hidden">
        {links.map((link) => {
          const Icon = link.icon;
          let shortName = link.name;
          if (link.name === 'User Control Panel') shortName = 'Users';
          if (link.name === 'Inventory Manager') shortName = 'Inventory';
          if (link.name === 'Medication Reminders') shortName = 'Reminders';
          if (link.name === 'Invoice History') shortName = 'Bills';
          if (link.name === 'My Profile') shortName = 'Profile';
          if (link.name === 'Medicine Shop') shortName = 'Shop';

          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) =>
                `flex h-full flex-1 flex-col items-center justify-center text-[10px] font-medium transition-colors ${
                  isActive ? 'text-teal-700 dark:text-teal-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`
              }
            >
              <Icon className="mb-0.5 h-4 w-4 shrink-0" />
              <span className="max-w-[65px] truncate tracking-tight">{shortName}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
};

export default Sidebar;
