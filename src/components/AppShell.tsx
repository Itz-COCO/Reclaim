import {useState} from 'react';
import {Menu,UserRound,X} from 'lucide-react';
import {NavLink,Outlet,Link,useLocation} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';
import {useWorkspace} from '../context/WorkspaceContext';

export function AppShell(){
  const{user}=useAuth();const{isRemote}=useWorkspace();const[menuOpen,setMenuOpen]=useState(false);const location=useLocation();
  const links=[{to:'/projects',label:'Projects',match:'/projects'},{to:'/evidence',label:'Evidence',match:'/evidence'}];
  const close=()=>setMenuOpen(false);
  return <div className="app-frame">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header">
      <Link to="/projects" className="brand-lockup" aria-label="Reclaim projects" onClick={close}><img src="/reclaim-logo.jpg" alt=""/></Link>
      <button className="mobile-menu-toggle" type="button" aria-label={menuOpen?'Close navigation':'Open navigation'} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={()=>setMenuOpen(value=>!value)}>{menuOpen?<X size={20}/>:<Menu size={20}/>}</button>
      <nav id="main-navigation" className={`primary-nav ${menuOpen?'nav-open':''}`} aria-label="Main navigation">
        {links.map(link=><NavLink key={link.to} to={link.to} onClick={close} className={({isActive})=>`nav-link ${isActive||location.pathname.startsWith(link.match+'/')?'active':''}`}>{link.label}</NavLink>)}
        <span className={`storage-chip ${isRemote?'storage-cloud':'storage-local'}`}><i aria-hidden="true"/>{isRemote?'Cloud workspace':'Private workspace'}</span>
        <Link className={`account-link ${location.pathname==='/account'?'active':''}`} to="/account" onClick={close}><span className="account-avatar">{user?.name?.trim().slice(0,1).toUpperCase()||<UserRound size={15}/>}</span><span>Account</span></Link>
      </nav>
    </header>
    <main className="workspace-main" id="main-content"><Outlet/></main>
  </div>;
}
