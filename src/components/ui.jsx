import { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Check, ChevronDown, LoaderCircle, X } from 'lucide-react';
import { initials } from '../lib/ledger.js';

export const spring = { type: 'spring', stiffness: 300, damping: 25 };

export function IconBox({ icon: Icon, tone = 'mint', size = 17, className = '' }) {
  return <span className={`icon-box tone-${tone} ${className}`} aria-hidden="true"><Icon size={size} strokeWidth={1.8} /></span>;
}

export function Avatar({ person, className = '' }) {
  return <span className={`avatar tone-${person.color || 'mint'} ${className}`} aria-hidden="true">{initials(person.name)}</span>;
}

export function PageHeading({ eyebrow, title, description, actions }) {
  return <header className="page-heading">
    <div className="min-w-0">
      <span className="eyebrow"><span aria-hidden="true" className="eyebrow-mark" />{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>;
}

export function PanelHeading({ icon, tone, title, description, actions }) {
  return <div className="panel-heading">
    <div className="panel-heading-main">
      {icon && <IconBox icon={icon} tone={tone} />}
      <div className="min-w-0"><h2>{title}</h2>{description && <p>{description}</p>}</div>
    </div>
    {actions}
  </div>;
}

export function EmptyState({ icon, title, description, children }) {
  return <div className="empty-state"><IconBox icon={icon} size={22} /><h3>{title}</h3><p>{description}</p>{children}</div>;
}

export function Drawer({ title, description, icon, children, onClose }) {
  const dialog = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const node = dialog.current;
    const focused = document.activeElement;
    node.showModal();
    return () => {
      if (node.open) node.close();
      if (focused instanceof HTMLElement && focused.isConnected) focused.focus();
    };
  }, []);
  return <dialog className="dialog" ref={dialog} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div className="dialog-inner" initial={{ opacity: 0, scale: 0.97, y: 9 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={spring}>
      <header className="dialog-heading">
        {icon && <IconBox icon={icon} size={21} />}
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button>
        <h2 id={titleId}>{title}</h2>
        {description && <p id={descriptionId}>{description}</p>}
      </header>
      {children}
    </motion.div>
  </dialog>;
}

export function Field({ label, hint, children, ...props }) {
  const id = useId();
  const help = hint ? `${id}-hint` : undefined;
  return <div className="field">
    <label htmlFor={id}>{label}</label>
    {children ? children(id, help) : <input id={id} aria-describedby={help} {...props} />}
    {hint && <span id={help} className="field-hint">{hint}</span>}
  </div>;
}

export function SelectField({ children, label, hint, ...props }) {
  return <Field label={label} hint={hint}>{(id, help) => <span className="select-wrap"><select id={id} aria-describedby={help} {...props}>{children}</select><ChevronDown aria-hidden="true" size={15} /></span>}</Field>;
}

export function FormAlert({ children }) {
  return children ? <div className="form-alert" role="alert"><AlertCircle size={17} />{children}</div> : null;
}

export function ActionForm({ children, submit, done, label = 'Save changes', cancel, variant = 'primary', footerClass = '', disabled = false }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function handleSubmit(event) {
    event.preventDefault();
    if (busy.current || disabled) return;
    const form = new FormData(event.currentTarget);
    busy.current = true;
    setPending(true);
    setError('');
    try { await submit(Object.fromEntries(form.entries()), form); done?.(); }
    catch (err) { setError(err?.message || 'Could not save changes. Please try again.'); }
    finally { busy.current = false; setPending(false); }
  }
  return <form className="action-form" onSubmit={handleSubmit} aria-busy={pending}>
    {children}
    <FormAlert>{error}</FormAlert>
    <div className={`form-actions ${footerClass}`}>
      {cancel && <button type="button" className="button button-secondary" onClick={cancel} disabled={pending}>Cancel</button>}
      <button className={`button button-${variant}`} disabled={pending || disabled} type="submit">{pending && <LoaderCircle className="spin" size={17} />}{label}</button>
    </div>
  </form>;
}

export function Toast({ message, dismiss }) {
  const { text, type } = message;
  useEffect(() => { const t = setTimeout(dismiss, 4700); return () => clearTimeout(t); }, [message, dismiss]);
  return <motion.div className={`toast toast-${type}`} initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={spring} role={type === 'error' ? 'alert' : 'status'}>
    <motion.div initial={{ scale: 0.35, rotate: -16 }} animate={{ scale: 1, rotate: 0 }} transition={spring}><IconBox icon={type === 'error' ? AlertCircle : Check} tone={type === 'error' ? 'rose' : 'mint'} /></motion.div>
    <span>{text}</span><button className="icon-button" aria-label="Dismiss message" onClick={dismiss}><X size={16} /></button>
  </motion.div>;
}
