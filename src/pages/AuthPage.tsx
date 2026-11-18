import {useState,type FormEvent} from 'react';
import {ArrowRight,LockKeyhole} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {useAuth} from '../context/AuthContext';

export function AuthPage(){
  const {backendConfigured,signIn,signUp,enterDemo}=useAuth();
  const navigate=useNavigate();
  const [mode,setMode]=useState<'signup'|'signin'>('signup');
  const [name,setName]=useState(''); const [email,setEmail]=useState(''); const [password,setPassword]=useState('');
  const [notice,setNotice]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('');
    try{if(backendConfigured){if(mode==='signup'){const result=await signUp(name,email,password);if(result.needsEmailConfirmation){setNotice('Account request received. Check your email, then sign in.');setMode('signin');}else navigate('/');}else{await signIn(email,password);navigate('/');}}else{enterDemo(name||email.split('@')[0]||'Reclaim researcher',email||'demo@reclaim.local');navigate('/');}}
    catch(caught){setError(caught instanceof Error?caught.message:'Something went wrong. Check the form and try again.');}finally{setBusy(false);}
  }
  return <div className="auth-page">
    <section className="auth-story"><img className="auth-story-logo" src="/reclaim-logo.jpg" alt="Reclaim"/><div className="auth-story-content"><p className="page-kicker">RECLAIM</p><h1>Keep each building project in one place.</h1><p>Record what is known, what is missing, and what needs checking next.</p></div><p className="auth-story-foot">Dakota Crescent is included as the first reviewed case.</p></section>
    <section className="auth-panel-wrap"><div className="auth-panel">
      <p className="page-kicker">{backendConfigured?'YOUR WORKSPACE':'PRIVATE WORKSPACE'}</p>
      <h2>{backendConfigured?(mode==='signup'?'Create an account':'Sign in'):'Open your workspace'}</h2>
      <p className="auth-intro">{backendConfigured?'Use your workspace account to continue.':'Your records stay private to this browser.'}</p>
      {backendConfigured&&<div className="auth-tabs"><button type="button" className={mode==='signup'?'auth-tab active':'auth-tab'} onClick={()=>{setMode('signup');setError('');setNotice('');}}>Create account</button><button type="button" className={mode==='signin'?'auth-tab active':'auth-tab'} onClick={()=>{setMode('signin');setError('');setNotice('');}}>Sign in</button></div>}
      <form className="auth-form" onSubmit={submit}>
        {(!backendConfigured||mode==='signup')&&<label>Full name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" autoComplete="name" required={!backendConfigured||mode==='signup'}/></label>}
        <label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={backendConfigured?'you@example.com':'Optional'} autoComplete="email" required={backendConfigured}/></label>
        {backendConfigured&&<label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" autoComplete={mode==='signup'?'new-password':'current-password'} minLength={6} required/></label>}
        {!backendConfigured&&<div className="local-auth-note"><LockKeyhole size={16}/><span>No password is stored. This is not a shared account.</span></div>}
        {error&&<div className="form-alert error-alert" role="alert">{error}</div>}{notice&&<div className="form-alert success-alert" role="status">{notice}</div>}
        <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy?'Please wait…':backendConfigured?(mode==='signup'?'Create account':'Sign in'):'Continue in this browser'}<ArrowRight size={17}/></button>
      </form>
      {!backendConfigured&&<><div className="auth-divider"><span>OR</span></div><button className="button button-secondary auth-submit" type="button" onClick={()=>{enterDemo();navigate('/');}}><LockKeyhole size={17}/>Continue privately</button></>}
      <p className="auth-footnote">{backendConfigured?'Your account is protected by project-level access controls.':'Private browser workspace. Shared project access is granted by project owners.'}</p>
    </div></section>
  </div>;
}
