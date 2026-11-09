import {useEffect,useState} from 'react';
import {ImagePlus,Trash2} from 'lucide-react';
import {Notice} from './UI';
import {supabase} from '../lib/supabase';
import {useAuth} from '../context/AuthContext';

type MediaRow={
  id:string;
  storage_path:string;
  caption:string;
  alt_text:string;
  visibility:'private'|'members'|'public';
  moderation_status:string;
  created_at:string;
  building_id:string|null;
};

export function ProjectMediaGallery({
  projectId,
  buildingId
}:{
  projectId:string;
  buildingId?:string;
}){
  const{user}=useAuth();

  const[items,setItems]=useState<MediaRow[]>([]);
  const[urls,setUrls]=useState<Record<string,string>>({});
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[notice,setNotice]=useState('');

  async function load(){
    if(!supabase||user?.mode!=='supabase')return;

    let query=supabase
      .from('project_media')
      .select('id,storage_path,caption,alt_text,visibility,moderation_status,created_at,building_id')
      .eq('project_id',projectId)
      .order('created_at',{ascending:false});

    if(buildingId){
      query=query.eq('building_id',buildingId);
    }

    const{data,error}=await query;

    if(error){
      setError(error.message);
      return;
    }

    const rows=(data??[]) as MediaRow[];
    setItems(rows);

    const signed=await Promise.all(
      rows.map(async row=>{
        const result=await supabase!
          .storage
          .from('project-media')
          .createSignedUrl(row.storage_path,3600);

        return [
          row.id,
          result.data?.signedUrl??''
        ] as const;
      })
    );

    setUrls(Object.fromEntries(signed));
  }

  useEffect(()=>{
    void load();
  },[projectId,buildingId,user?.mode]);

  async function upload(file:File|undefined){
    if(!file||!supabase||!user)return;

    if(!file.type.startsWith('image/')){
      setError('Choose an image file.');
      return;
    }

    if(file.size>8*1024*1024){
      setError('Images must be 8 MB or smaller.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    const extension=file.name.split('.').pop()||'jpg';
    const path=`${projectId}/${crypto.randomUUID()}.${extension}`;

    const uploadResult=await supabase
      .storage
      .from('project-media')
      .upload(path,file,{
        contentType:file.type,
        upsert:false
      });

    if(uploadResult.error){
      setError(uploadResult.error.message);
      setBusy(false);
      return;
    }

    const{error:rowError}=await supabase
      .from('project_media')
      .insert({
        project_id:projectId,
        building_id:buildingId??null,
        uploaded_by:user.id,
        storage_path:path,
        caption:file.name.replace(/\.[^.]+$/,''),
        alt_text:file.name,
        visibility:'private',
        moderation_status:'pending'
      });

    if(rowError){
      await supabase.storage.from('project-media').remove([path]);
      setError(rowError.message);
    }else{
      setNotice('Photo uploaded privately and queued for review.');
      await load();
    }

    setBusy(false);
  }

  async function remove(item:MediaRow){
    if(!supabase)return;
    if(!window.confirm('Remove this photo?'))return;

    setBusy(true);

    const{error}=await supabase
      .from('project_media')
      .delete()
      .eq('id',item.id);

    if(error){
      setError(error.message);
    }else{
      await supabase
        .storage
        .from('project-media')
        .remove([item.storage_path]);

      await load();
    }

    setBusy(false);
  }

  return (
    <section className="media-gallery surface-card">
      <div className="media-gallery-heading">
        <div>
          <p className="page-kicker">VISUAL EVIDENCE</p>
          <h2>Building photographs</h2>
          <p>
            Photos are private and pending review by default. Only approved
            public images appear on the public case.
          </p>
        </div>

        <label className="button button-secondary">
          <ImagePlus size={15}/>
          {busy?'Uploading…':'Add photo'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={event=>void upload(event.target.files?.[0])}
          />
        </label>
      </div>

      {error&&<Notice tone="warning">{error}</Notice>}
      {notice&&<Notice tone="success">{notice}</Notice>}

      {items.length ? (
        <div className="media-grid">
          {items.map(item=>(
            <figure className="media-card" key={item.id}>
              <img
                src={urls[item.id]||''}
                alt={item.alt_text||'Project photograph'}
              />

              <figcaption>
                <strong>{item.caption||'Untitled photograph'}</strong>
                <span>
                  {item.moderation_status} · {item.visibility}
                </span>
              </figcaption>

              <button
                className="icon-button media-remove"
                type="button"
                title="Remove photo"
                onClick={()=>void remove(item)}
                disabled={busy}
              >
                <Trash2 size={14}/>
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <div className="media-empty">
          No building photographs have been uploaded yet.
        </div>
      )}
    </section>
  );
}
