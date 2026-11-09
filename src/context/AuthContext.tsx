import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import type {AppUser,ProfilePatch} from '../types';
import {localStore} from '../lib/localStore';
import {isSupabaseConfigured,supabase} from '../lib/supabase';

interface AuthContextValue{
  user:AppUser|null;loading:boolean;backendConfigured:boolean;
  signIn:(email:string,password:string)=>Promise<void>;
  signUp:(name:string,email:string,password:string)=>Promise<{needsEmailConfirmation:boolean}>;
  enterDemo:(name?:string,email?:string)=>void;
  updateProfile:(name:string)=>Promise<void>;
  updateProfileDetails:(patch:ProfilePatch)=>Promise<void>;
  uploadAvatar:(file:File)=>Promise<string>;
  requestPasswordReset:(email:string)=>Promise<void>;
  updatePassword:(password:string)=>Promise<void>;
  signOut:()=>Promise<void>;
}
const AuthContext=createContext<AuthContextValue|null>(null);
function fromAuthUser(authUser:{
  id:string;
  email?:string;
  user_metadata?:Record<string,unknown>;
}):AppUser{
  const meta=authUser.user_metadata??{};
  return {
    id:authUser.id,
    email:authUser.email??'',
    name:String(meta.full_name??authUser.email?.split('@')[0]??'Reclaim member'),
    mode:'supabase',
    avatarUrl:typeof meta.avatar_url==='string'?meta.avatar_url:undefined,
    bio:typeof meta.bio==='string'?meta.bio:'',
    websiteUrl:typeof meta.website_url==='string'?meta.website_url:'',
    instagramUrl:typeof meta.instagram_url==='string'?meta.instagram_url:'',
    linkedinUrl:typeof meta.linkedin_url==='string'?meta.linkedin_url:'',
    xUrl:typeof meta.x_url==='string'?meta.x_url:'',
    publicProfile:meta.public_profile===true
  };
}

export function AuthProvider({children}:{children:ReactNode}){
  const [user,setUser]=useState<AppUser|null>(()=>localStore.readUser());
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    if(!supabase){setLoading(false);return;}
    let active=true;
    supabase.auth.getSession().then(({data,error})=>{if(!active)return;if(error)console.error('Supabase session check failed:',error.message);if(data.session?.user){localStore.clearUser();setUser(fromAuthUser(data.session.user));}else setUser(localStore.readUser());setLoading(false);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(!active)return;if(session?.user){localStore.clearUser();setUser(fromAuthUser(session.user));}else setUser(localStore.readUser());setLoading(false);});
    return()=>{active=false;subscription.unsubscribe();};
  },[]);

  const value=useMemo<AuthContextValue>(()=>({
    user,loading,backendConfigured:isSupabaseConfigured,
    async signIn(email,password){if(!supabase)throw new Error('Supabase is not configured. Use the browser demo or follow the setup guide.');const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;if(data.user){localStore.clearUser();setUser(fromAuthUser(data.user));}},
    async signUp(name,email,password){if(!supabase)throw new Error('Supabase is not configured. Use the browser demo or follow the setup guide.');const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}});if(error)throw error;if(data.session?.user){localStore.clearUser();setUser(fromAuthUser(data.session.user));}return{needsEmailConfirmation:!data.session};},
    enterDemo(name='Researcher',email=''){const demoUser:AppUser={id:`demo-${crypto.randomUUID()}`,name:name.trim()||'Researcher',email:email.trim(),mode:'demo'};localStore.writeUser(demoUser);setUser(demoUser);},
    async updateProfile(name){if(!user)throw new Error('Sign in to update your profile.');const clean=name.trim();if(!clean)throw new Error('Enter a name.');if(user.mode==='supabase'&&supabase){const{error:authError}=await supabase.auth.updateUser({data:{full_name:clean}});if(authError)throw authError;const{error:profileError}=await supabase.from('profiles').update({full_name:clean}).eq('id',user.id);if(profileError)throw profileError;}const next={...user,name:clean};if(user.mode==='demo')localStore.writeUser(next);setUser(next);},
    async updateProfileDetails(patch){
  if(!user)throw new Error('Sign in to update your profile.');
  const clean=patch.name.trim();
  if(!clean)throw new Error('Enter a name.');

  const next={
    ...user,
    name:clean,
    bio:patch.bio.trim(),
    websiteUrl:patch.websiteUrl.trim(),
    instagramUrl:patch.instagramUrl.trim(),
    linkedinUrl:patch.linkedinUrl.trim(),
    xUrl:patch.xUrl.trim(),
    avatarUrl:patch.avatarUrl??user.avatarUrl,
    publicProfile:patch.publicProfile??user.publicProfile??false
  };

  if(user.mode==='supabase'&&supabase){
    const metadata={
      full_name:clean,
      bio:next.bio,
      website_url:next.websiteUrl,
      instagram_url:next.instagramUrl,
      linkedin_url:next.linkedinUrl,
      x_url:next.xUrl,
      avatar_url:next.avatarUrl??'',
      public_profile:next.publicProfile
    };

    const{error:authError}=await supabase.auth.updateUser({data:metadata});
    if(authError)throw authError;

    const{error:profileError}=await supabase
      .from('profiles')
      .update({
        full_name:clean,
        bio:next.bio,
        website_url:next.websiteUrl,
        instagram_url:next.instagramUrl,
        linkedin_url:next.linkedinUrl,
        x_url:next.xUrl,
        avatar_url:next.avatarUrl??'',
        public_profile:next.publicProfile
      })
      .eq('id',user.id);

    if(profileError)throw profileError;
  }

  if(user.mode==='demo')localStore.writeUser(next);
  setUser(next);
},

    async uploadAvatar(file){if(!user)throw new Error('Sign in to update your profile.');if(!file.type.startsWith('image/'))throw new Error('Choose an image file.');if(file.size>5*1024*1024)throw new Error('Profile images must be 5 MB or smaller.');if(user.mode==='supabase'&&supabase){const extension=file.type.split('/')[1]||'jpg';const path=`${user.id}/avatar.${extension}`;const{error}=await supabase.storage.from('profile-avatars').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(error)throw error;const{data}=supabase.storage.from('profile-avatars').getPublicUrl(path);const next={...user,avatarUrl:`${data.publicUrl}?v=${Date.now()}`};await supabase.auth.updateUser({data:{avatar_url:next.avatarUrl}});await supabase.from('profiles').update({avatar_url:next.avatarUrl}).eq('id',user.id);setUser(next);return next.avatarUrl;}const reader=new FileReader();const url=await new Promise<string>((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Could not read that image.'));reader.readAsDataURL(file);});const next={...user,avatarUrl:url};localStore.writeUser(next);setUser(next);return url;},
    async requestPasswordReset(email){if(!supabase)throw new Error('Password recovery requires a configured Supabase project.');const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/auth?mode=recovery`});if(error)throw error;},
    async updatePassword(password){if(!supabase)throw new Error('Password update requires a configured Supabase project.');const {error}=await supabase.auth.updateUser({password});if(error)throw error;},
    async signOut(){if(user?.mode==='supabase'&&supabase){const {error}=await supabase.auth.signOut();if(error)throw error;}localStore.clearUser();setUser(null);},
  }),[user,loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used inside AuthProvider');return context;}
