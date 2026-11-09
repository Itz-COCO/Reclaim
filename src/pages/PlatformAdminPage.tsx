import {useCallback,useEffect,useState} from 'react';
import {ShieldCheck,UserPlus,UserX} from 'lucide-react';
import {useNavigate} from 'react-router-dom';
import {PageHeader,Notice,EmptyState} from '../components/UI';
import {useAuth} from '../context/AuthContext';
import {supabase} from '../lib/supabase';

type PlatformMember={
  user_id:string;
  role:'owner'|'operator';
  display_name:string;
  created_at:string;
};

export function PlatformAdminPage(){
  const{user}=useAuth();
  const navigate=useNavigate();

  const[items,setItems]=useState<PlatformMember[]>([]);
  const[email,setEmail]=useState('');
  const[role,setRole]=useState<'operator'|'owner'>('operator');
  const[loading,setLoading]=useState(true);
  const[busy,setBusy]=useState(false);
  const[allowed,setAllowed]=useState(false);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');

  const load=useCallback(async()=>{
    if(!supabase||user?.mode!=='supabase'){
      setLoading(false);
      return;
    }

    const{data,error}=await supabase.rpc(
      'is_reclaim_platform_owner'
    );

    if(error||!data){
      setLoading(false);
      setAllowed(false);
      return;
    }

    setAllowed(true);

    const result=await supabase
      .from('platform_members')
      .select('user_id,role,display_name,created_at')
      .order('created_at',{ascending:true});

    if(result.error){
      setError(result.error.message);
    }else{
      setItems((result.data??[]) as PlatformMember[]);
    }

    setLoading(false);
  },[user?.id,user?.mode]);

  useEffect(()=>{
    void load();
  },[load]);

  async function addMember(event:React.FormEvent){
    event.preventDefault();

    if(!supabase)return;

    const value=email.trim().toLowerCase();

    if(!/^\S+@\S+\.\S+$/.test(value)){
      setError(
        'Enter the teammate’s existing Reclaim account email.'
      );
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    const{error}=await supabase.rpc(
      'grant_reclaim_platform_role',
      {
        target_email:value,
        target_role:role
      }
    );

    if(error){
      setError(error.message);
    }else{
      setEmail('');
      setNotice('Platform role saved.');
      await load();
    }

    setBusy(false);
  }

  async function removeMember(item:PlatformMember){
    if(!supabase)return;

    if(
      item.role==='owner'&&
      items.filter(row=>row.role==='owner').length<=1
    ){
      setError(
        'The final platform owner cannot be removed.'
      );
      return;
    }

    if(!window.confirm('Remove this platform role?')){
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    const{error}=await supabase
      .from('platform_members')
      .delete()
      .eq('user_id',item.user_id);

    if(error){
      setError(error.message);
    }else{
      setNotice('Platform role removed.');
      await load();
    }

    setBusy(false);
  }

  if(loading){
    return (
      <Notice>
        Checking platform permissions…
      </Notice>
    );
  }

  if(!allowed){
    return (
      <EmptyState
        title="Platform management is restricted"
        body="Only a Reclaim platform owner can manage trusted operators."
        action={
          <button
            className="button button-secondary"
            onClick={()=>navigate('/projects')}
          >
            Return to projects
          </button>
        }
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="PLATFORM CONTROL"
        title="Trusted operators"
        description="Platform roles apply across projects. They do not replace project-level access controls."
      />

      <section className="surface-card platform-admin-card">
        <div className="platform-admin-intro">
          <ShieldCheck size={22}/>

          <div>
            <strong>
              Owner-controlled access
            </strong>

            <p>
              Enter a teammate’s existing Reclaim account
              email. Project permissions and public visibility
              remain separate.
            </p>
          </div>
        </div>

        {error&&(
          <Notice tone="warning">
            {error}
          </Notice>
        )}

        {notice&&(
          <Notice tone="success">
            {notice}
          </Notice>
        )}

        <form
          className="platform-member-form"
          onSubmit={addMember}
        >
          <label className="form-field">
            <span>
              Teammate account email
            </span>

            <input
              type="email"
              value={email}
              onChange={event=>setEmail(event.target.value)}
              placeholder="teammate@example.com"
              required
            />
          </label>

          <label className="form-field">
            <span>
              Platform role
            </span>

            <select
              value={role}
              onChange={event=>
                setRole(
                  event.target.value as
                  'operator'|'owner'
                )
              }
            >
              <option value="operator">
                Operator
              </option>

              <option value="owner">
                Owner
              </option>
            </select>
          </label>

          <button
            className="button button-primary"
            disabled={busy}
          >
            <UserPlus size={15}/>
            {busy?'Saving…':'Grant role'}
          </button>
        </form>

        <div className="platform-member-list">
          <h2>
            Current platform roles
          </h2>

          {items.map(item=>(
            <div
              className="platform-member-row"
              key={item.user_id}
            >
              <div>
                <strong>
                  {item.display_name||'Trusted teammate'}
                </strong>

                <code>
                  {item.user_id}
                </code>
              </div>

              <span className="status-badge status-positive">
                {item.role}
              </span>

              <button
                className="icon-button"
                type="button"
                title="Remove role"
                onClick={()=>void removeMember(item)}
                disabled={
                  busy||item.user_id===user?.id
                }
              >
                <UserX size={15}/>
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
