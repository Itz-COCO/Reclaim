import {useEffect,useState} from 'react';

interface ProfileAvatarProps{
  src?:string;
  name?:string;
  size?:'small'|'large'|'owner';
  alt?:string;
}

export function ProfileAvatar({src,name,size='small',alt=''}:ProfileAvatarProps){
  const [imageFailed,setImageFailed]=useState(false);
  const initial=name?.trim().slice(0,1).toUpperCase()||'R';

  useEffect(()=>{
    setImageFailed(false);
  },[src]);

  return <span className={`profile-avatar profile-avatar-${size}`} aria-label={alt||undefined} role={alt?'img':undefined}>
    {src&&!imageFailed
      ? <img src={src} alt={alt} onError={()=>setImageFailed(true)}/>
      : initial}
  </span>;
}
