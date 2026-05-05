'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  BarChart2,
  PieChart,
  TrendingUp,
  List,
  Cpu,
  Link2,
  MapPin,
  FileText,
  Stethoscope,
  Globe,
  LogOut,
} from 'lucide-react';

const sections = [
  { href: 'overview',       label: 'Citation Overview',   icon: TrendingUp  },
  { href: 'share-of-voice', label: 'Share of Voice',      icon: BarChart2   },
  { href: 'sentiment',      label: 'Sentiment Analysis',  icon: PieChart    },
  { href: 'prompts',        label: 'Prompt Analysis',     icon: List        },
  { href: 'engines',        label: 'Engine Breakdown',    icon: Cpu         },
  { href: 'sources',        label: 'Citation Sources',    icon: Link2       },
  { href: 'geo',            label: 'Geographic',          icon: MapPin      },
  { href: 'content',        label: 'Content',             icon: FileText    },
  { href: 'diagnostics',    label: 'Diagnostics',         icon: Stethoscope },
  { href: 'offsite',        label: 'Off-Site Builder',    icon: Globe       },
];

interface SidebarProps {
  clientId: string;
  brandName?: string;
}

export default function Sidebar({ clientId, brandName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/login');
  }

  return (
    <aside className="w-14 md:w-56 shrink-0 flex flex-col h-screen bg-white border-r border-slate-200">
      <div className="px-3 md:px-4 py-5 border-b border-slate-100">
        <p className="hidden md:block text-xs font-semibold text-slate-400 uppercase tracking-wider">AEO Suite</p>
        <p className="hidden md:block text-sm font-medium text-slate-900 mt-0.5 truncate">{brandName ?? clientId}</p>
        <div className="md:hidden flex justify-center">
          <span className="text-xs font-bold text-blue-600">A</span>
        </div>
      </div>

      <nav className="flex-1 px-1 md:px-2 py-3 space-y-0.5 overflow-y-auto">
        {sections.map(({ href, label, icon: Icon }) => {
          const full = `/dashboard/${clientId}/${href}`;
          const active = pathname === full;
          return (
            <Link
              key={href}
              href={full}
              title={label}
              className={cn(
                'flex items-center gap-2.5 px-2 md:px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              )}
            >
              <Icon size={15} className="shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-1 md:px-2 py-3 border-t border-slate-100">
        <button
          onClick={handleLogout}
          title="Sign out"
          className="flex items-center gap-2.5 px-2 md:px-3 py-2 w-full rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut size={15} className="shrink-0" />
          <span className="hidden md:inline">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
