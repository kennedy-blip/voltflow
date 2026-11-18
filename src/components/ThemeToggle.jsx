import { Check, Grid2X2, Moon, Palette, Sun } from 'lucide-react';
import { updateTheme } from '../db/actions.js';
import { useWorkspace } from '../lib/workspace.js';
import { PanelHeading } from './ui.jsx';

const themes = [
  { id: 'electric', label: 'Electric Neon', subtitle: 'Obsidian & mint', icon: Moon },
  { id: 'solar', label: 'Solar Glass', subtitle: 'Frosted light & amber', icon: Sun },
  { id: 'matrix', label: 'Cyberpunk Matrix', subtitle: 'Emerald grid', icon: Grid2X2 },
];
export default function ThemeToggle() {
  const { data, notice } = useWorkspace();
  return <section className="glass-panel settings-panel"><PanelHeading icon={Palette} tone="violet" title="Appearance" description="Pick a look for your workspace." />
    <div className="theme-options" aria-label="Color theme">{themes.map(({ id, label, subtitle, icon: Icon }) => {
      const active = data.settings.theme === id;
      return <button key={id} className="theme-card" type="button" aria-pressed={active} onClick={() => { if (!active) updateTheme(id).catch((error) => notice(error.message, 'error')); }}>
        <span className={`theme-preview preview-${id}`} aria-hidden="true"><Icon size={17} /><i /><i /><i />{active && <span><Check size={12} strokeWidth={2.4} /></span>}</span><strong>{label}</strong><small>{subtitle}</small>
      </button>;
    })}</div>
  </section>;
}
