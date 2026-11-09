import {useEffect,useState} from 'react';
import {ArrowRight,ExternalLink,LocateFixed,MapPin} from 'lucide-react';
import {Link,useParams} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import {demoProject,demoBuildings} from '../data/seed';
import {Notice} from '../components/UI';

type PublicProject={
  id:string;
  slug?:string;
  name:string;
  description:string;
  region:string;
  country:string;
  location_label?:string;
  public_latitude?:number|null;
  public_longitude?:number|null;
  public_gallery_enabled?:boolean;
  owner_id?:string;
};

type PublicBuilding={
  id:string;
  name:string;
  address:string;
  building_type:string;
  current_use:string;
  condition:string;
  notes:string;
};

type PublicMedia={
  id:string;
  storage_path:string;
  caption:string;
  alt_text:string;
};

type PublicProfile={
  full_name:string;
  bio:string;
  avatar_url:string;
  website_url:string;
  instagram_url:string;
  linkedin_url:string;
  x_url:string;
};

type NearbyProject={
  id:string;
  name:string;
  location_label?:string;
  public_latitude:number;
  public_longitude:number;
  distance:number;
};

function distanceKm(
  aLat:number,
  aLon:number,
  bLat:number,
  bLon:number
){
  const radians=(value:number)=>value*Math.PI/180;
  const earth=6371;
  const dLat=radians(bLat-aLat);
  const dLon=radians(bLon-aLon);
  const x=
    Math.sin(dLat/2)**2+
    Math.cos(radians(aLat))*
    Math.cos(radians(bLat))*
    Math.sin(dLon/2)**2;

  return earth*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function formatDistance(km:number){
  return km<1
    ? `${Math.round(km*1000)} m away`
    : `${km.toFixed(km<10?1:0)} km away`;
}

export function PublicDakotaPage(){
  const{slug='dakota-crescent'}=useParams();

  const[project,setProject]=useState<PublicProject|null>(null);
  const[buildings,setBuildings]=useState<PublicBuilding[]>([]);
  const[media,setMedia]=useState<Array<PublicMedia&{url:string}>>([]);
  const[profile,setProfile]=useState<PublicProfile|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const[nearby,setNearby]=useState<NearbyProject[]>([]);
  const[nearbyBusy,setNearbyBusy]=useState(false);
  const[nearbyError,setNearbyError]=useState('');

  useEffect(()=>{
    let active=true;

    async function load(){
      if(!supabase){
        if(active){
          setProject({
            id:demoProject.id,
            name:demoProject.name,
            description:demoProject.description,
            region:demoProject.region,
            country:demoProject.country,
            location_label:'Dakota Crescent, Singapore'
          });

          setBuildings(
            demoBuildings.map(item=>({
              id:item.id,
              name:item.name,
              address:item.address,
              building_type:item.buildingType,
              current_use:item.currentUse,
              condition:item.condition,
              notes:item.notes
            }))
          );

          setLoading(false);
        }

        return;
      }

      const{data,error:projectError}=await supabase
        .from('projects')
        .select(`
          id,
          slug,
          name,
          description,
          region,
          country,
          location_label,
          public_latitude,
          public_longitude,
          public_gallery_enabled,
          owner_id
        `)
        .eq('slug',slug)
        .eq('visibility','public')
        .single();

      if(projectError){
        if(active){
          setError(projectError.message);
          setLoading(false);
        }

        return;
      }

      const[buildingResult,mediaResult,profileResult]=await Promise.all([
        supabase
          .from('buildings')
          .select('id,name,address,building_type,current_use,condition,notes')
          .eq('project_id',data.id)
          .eq('public_visibility','public'),

        supabase
          .from('project_media')
          .select('id,storage_path,caption,alt_text')
          .eq('project_id',data.id)
          .eq('visibility','public')
          .eq('moderation_status','approved'),

        data.owner_id
          ? supabase
              .from('profiles')
              .select('full_name,bio,avatar_url,website_url,instagram_url,linkedin_url,x_url')
              .eq('id',data.owner_id)
              .eq('public_profile',true)
              .maybeSingle()
          : Promise.resolve({data:null,error:null})
      ]);

      if(!active)return;

      if(buildingResult.error){
        setError(buildingResult.error.message);
      }

      setProject(data as PublicProject);
      setBuildings((buildingResult.data??[]) as PublicBuilding[]);
      setProfile((profileResult.data??null) as PublicProfile|null);

      if(!mediaResult.error&&data.public_gallery_enabled){
        const signed=await Promise.all(
          (mediaResult.data??[]).map(async row=>{
            const result=await supabase!
              .storage
              .from('project-media')
              .createSignedUrl(row.storage_path,3600);

            return {
              ...row,
              url:result.data?.signedUrl??''
            };
          })
        );

        setMedia(signed.filter(item=>item.url));
      }

      setLoading(false);
    }

    void load();

    return()=>{
      active=false;
    };
  },[slug]);

  async function findNearby(){
    if(!navigator.geolocation){
      setNearbyError('Location is not available in this browser.');
      return;
    }

    setNearbyBusy(true);
    setNearbyError('');
    setNearby([]);

    navigator.geolocation.getCurrentPosition(
      async position=>{
        try{
          if(!supabase){
            setNearbyError(
              'Nearby discovery becomes available after public project locations are published.'
            );
            return;
          }

          const{data,error:queryError}=await supabase
            .from('projects')
            .select('id,name,location_label,public_latitude,public_longitude')
            .eq('visibility','public')
            .not('public_latitude','is',null)
            .not('public_longitude','is',null);

          if(queryError)throw queryError;

          const rows=(data??[])
            .map(row=>({
              ...row,
              distance:distanceKm(
                position.coords.latitude,
                position.coords.longitude,
                Number(row.public_latitude),
                Number(row.public_longitude)
              )
            }))
            .filter(row=>row.distance<=50)
            .sort((a,b)=>a.distance-b.distance)
            .slice(0,8) as NearbyProject[];

          setNearby(rows);
        }catch(caught){
          setNearbyError(
            caught instanceof Error
              ? caught.message
              : 'Nearby projects could not be loaded.'
          );
        }finally{
          setNearbyBusy(false);
        }
      },
      ()=>{
        setNearbyBusy(false);
        setNearbyError(
          'Location access was not granted. Your location is never stored by Reclaim.'
        );
      },
      {
        enableHighAccuracy:false,
        maximumAge:300000,
        timeout:10000
      }
    );
  }

  if(loading){
    return <div className="public-case-loading">Opening the public case…</div>;
  }

  if(error&&!project){
    return(
      <main className="public-case-page">
        <Notice tone="warning">
          This public case is temporarily unavailable.
        </Notice>
      </main>
    );
  }

  if(!project)return null;

  const mapsQuery=encodeURIComponent(
    project.location_label||
    `${project.name}, ${project.region}, ${project.country}`
  );

  const publicLat=Number(project.public_latitude);
  const publicLon=Number(project.public_longitude);

  const hasCoords=
    project.public_latitude!=null&&
    project.public_longitude!=null&&
    Number.isFinite(publicLat)&&
    Number.isFinite(publicLon);

  const mapSrc=hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${publicLon-0.005}%2C${publicLat-0.005}%2C${publicLon+0.005}%2C${publicLat+0.005}&layer=mapnik&marker=${publicLat}%2C${publicLon}`
    : '';

  return(
    <main className="public-case-page">
      <header className="public-case-header">
        <Link className="public-brand" to="/auth">
          <img src="/reclaim-logo.jpg" alt="Reclaim"/>
        </Link>

        <Link className="public-signin" to="/auth">
          Open Reclaim workspace <ArrowRight size={15}/>
        </Link>
      </header>

      <div className="public-case-inner">
        <p className="page-kicker">PUBLIC CASE STUDY</p>

        <h1>{project.name}</h1>

        <p className="public-case-lede">
          {project.description}
        </p>

        <div className="public-case-meta">
          <span>
            <MapPin size={15}/>
            {project.location_label||
              [project.region,project.country].filter(Boolean).join(', ')}
          </span>

          <a
            className="text-link"
            href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps <ExternalLink size={14}/>
          </a>
        </div>

        {profile&&(
          <section className="public-owner-card">
            <div>
              {profile.avatar_url&&(
                <img src={profile.avatar_url} alt=""/>
              )}

              <div>
                <p className="page-kicker">PROJECT OWNER</p>
                <strong>{profile.full_name||'Project owner'}</strong>
                {profile.bio&&<p>{profile.bio}</p>}
              </div>
            </div>

            <div>
              {[
                profile.website_url,
                profile.instagram_url,
                profile.linkedin_url,
                profile.x_url
              ]
                .filter(Boolean)
                .map(url=>(
                  <a
                    className="text-link"
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Profile link <ExternalLink size={13}/>
                  </a>
                ))}
            </div>
          </section>
        )}

        <section className="public-case-location">
          <div>
            <p className="page-kicker">PLACE</p>

            <h2>
              {hasCoords
                ? 'Exact building location'
                : 'Understand the place before changing it.'}
            </h2>

            <p>
              {hasCoords
                ? 'The owner has chosen to publish this exact map point for this public project.'
                : 'The project owner has not published an exact map point yet.'}
            </p>

            <button
              type="button"
              className="button button-secondary nearby-button"
              onClick={findNearby}
              disabled={nearbyBusy}
            >
              <LocateFixed size={15}/>
              {nearbyBusy
                ? 'Finding public projects…'
                : 'Find public projects near me'}
            </button>

            {nearbyError&&(
              <p className="nearby-error">{nearbyError}</p>
            )}

            {nearby.length>0&&(
              <div className="nearby-results">
                <strong>Public projects nearby</strong>

                {nearby.map(item=>(
                  <div className="nearby-row" key={item.id}>
                    <span>
                      {item.name}
                      <small>
                        {item.location_label||'Public location'}
                      </small>
                    </span>
                    <b>{formatDistance(item.distance)}</b>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="public-map-placeholder">
            {hasCoords
              ? <iframe
                  className="public-map-embed"
                  title={`Map of ${project.name}`}
                  src={mapSrc}
                />
              : <>
                  <MapPin size={24}/>
                  <strong>
                    {project.location_label||'Location under review'}
                  </strong>
                  <span>Exact coordinates have not been published</span>
                </>}
          </div>
        </section>

        {project.public_gallery_enabled&&(
          <section className="public-case-section">
            <div className="public-section-heading">
              <div>
                <p className="page-kicker">GALLERY</p>
                <h2>What the place looks like</h2>
              </div>

              <span>{media.length} approved</span>
            </div>

            {media.length
              ? <div className="media-grid">
                  {media.map(item=>(
                    <figure className="media-card" key={item.id}>
                      <img
                        src={item.url}
                        alt={item.alt_text||item.caption||'Project photograph'}
                      />
                      <figcaption>
                        <strong>
                          {item.caption||'Project photograph'}
                        </strong>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              : <p className="public-empty">
                  No approved public photographs have been added yet.
                </p>}
          </section>
        )}

        <section className="public-case-section">
          <div className="public-section-heading">
            <div>
              <p className="page-kicker">BUILDINGS</p>
              <h2>What is being investigated</h2>
            </div>

            <span>{buildings.length} published</span>
          </div>

          {buildings.length
            ? <div className="public-building-list">
                {buildings.map(building=>(
                  <article
                    className="public-building-card"
                    key={building.id}
                  >
                    <p className="page-kicker">BUILDING RECORD</p>
                    <h3>{building.name}</h3>
                    <p>{building.address}</p>

                    <dl>
                      <div>
                        <dt>Type</dt>
                        <dd>{building.building_type||'Not recorded'}</dd>
                      </div>

                      <div>
                        <dt>Current use</dt>
                        <dd>{building.current_use||'Not recorded'}</dd>
                      </div>

                      <div>
                        <dt>Condition</dt>
                        <dd>{building.condition||'Needs verification'}</dd>
                      </div>
                    </dl>

                    {building.notes&&(
                      <p className="public-building-note">
                        {building.notes}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            : <p className="public-empty">
                No building records have been published yet.
              </p>}
        </section>

        <section className="public-case-cta">
          <div>
            <p className="page-kicker">TAKE PART</p>
            <h2>Have useful local knowledge?</h2>
            <p>
              Share context with the project team or request access to the
              private workspace. Submissions are reviewed before they become
              part of the official record.
            </p>
          </div>

          <Link className="button button-primary" to="/auth">
            Request access <ArrowRight size={16}/>
          </Link>
        </section>
      </div>
    </main>
  );
}
