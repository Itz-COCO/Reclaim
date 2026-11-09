import {useState} from 'react';
import {LocateFixed,MapPin,ExternalLink} from 'lucide-react';
import type {Project} from '../types';
import {supabase} from '../lib/supabase';

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

function readableLocationLabel(
  value:string|undefined,
  fallback:string
){
  if(!value)return fallback;

  try{
    const url=new URL(value);
    const placeMatch=url.pathname.match(/\/maps\/place\/([^/]+)/);

    if(placeMatch){
      return decodeURIComponent(placeMatch[1])
        .replace(/\+/g,' ')
        .replace(/\s+/g,' ')
        .trim();
    }

    return fallback;
  }catch{
    return value.length>140?fallback:value;
  }
}

function locationDisplayName(project:Project){
  return readableLocationLabel(
    project.locationLabel,
    [project.name,project.region,project.country]
      .filter(Boolean)
      .join(', ')
  );
}

function googleMapsHref(project:Project){
  const value=project.locationLabel?.trim();

  if(value&&/^https?:\/\/(www\.)?(google\.[^/]+|maps\.google\.[^/]+|maps\.app\.goo\.gl)/i.test(value) ){
    return value;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    value||`${project.name}, ${project.region}, ${project.country}`
  )}`;
}

export function ProjectLocationPanel({
  project
}:{
  project:Project;
}){
  const[nearby,setNearby]=useState<NearbyProject[]>([]);
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');

  const latitude=project.latitude??project.publicLatitude;
  const longitude=project.longitude??project.publicLongitude;

  const hasCoordinates=
    latitude!=null&&
    longitude!=null&&
    Number.isFinite(Number(latitude))&&
    Number.isFinite(Number(longitude));

  const lat=Number(latitude);
  const lon=Number(longitude);

  const mapSrc=hasCoordinates
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.005}%2C${lat-0.005}%2C${lon+0.005}%2C${lat+0.005}&layer=mapnik&marker=${lat}%2C${lon}`
    : '';

  async function findNearby(){
    if(!navigator.geolocation){
      setError('Location is not available in this browser.');
      return;
    }

    const client=supabase;

    if(!client){
      setError('Nearby search requires the connected workspace.');
      return;
    }

    setBusy(true);
    setError('');
    setNearby([]);

    navigator.geolocation.getCurrentPosition(
      async position=>{
        try{
          const{data,error:queryError}=await client
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
          setError(
            caught instanceof Error
              ? caught.message
              : 'Nearby projects could not be loaded.'
          );
        }finally{
          setBusy(false);
        }
      },
      ()=>{
        setBusy(false);
        setError(
          'Location access was not granted. Your location is not stored by Reclaim.'
        );
      },
      {
        enableHighAccuracy:false,
        maximumAge:300000,
        timeout:10000
      }
    );
  }

  return(
    <section className="project-location-panel surface-card">
      <div className="project-location-heading">
        <div>
          <p className="page-kicker">PROJECT LOCATION</p>

          <h2>
            {locationDisplayName(project)||'Location not added yet'}
          </h2>

          <p>
            {hasCoordinates
              ? 'This map is visible to signed-in members with access to this project.'
              : 'Add a confirmed Google Maps link in Project details to show the map here.'}
          </p>
        </div>

        <MapPin size={21} aria-hidden="true"/>
      </div>

      <div className="project-location-content">
        <div className="project-location-map">
          {hasCoordinates
            ? <iframe
                title={`Map of ${project.name}`}
                src={mapSrc}
                loading="lazy"
              />
            : <div className="project-location-empty">
                <MapPin size={25}/>
                <strong>No confirmed map point yet</strong>
                <span>
                  Open Project details and paste a confirmed Google Maps link.
                </span>
              </div>}
        </div>

        <div className="project-location-actions">
          <div className="location-privacy-status">
            <span>Public display</span>

            <strong>
              {project.locationPrecision==='exact'
                ? 'Exact point'
                : project.locationPrecision==='approximate'
                  ? 'Approximate area'
                  : project.locationPrecision==='area'
                    ? 'Area label only'
                    : 'Hidden'}
            </strong>
          </div>

          <a
            className="button button-secondary"
            href={googleMapsHref(project)}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps
            <ExternalLink size={15}/>
          </a>

          <button
            type="button"
            className="button button-secondary"
            onClick={findNearby}
            disabled={busy}
          >
            <LocateFixed size={15}/>
            {busy
              ? 'Finding nearby projects…'
              : 'Find public projects near me'}
          </button>

          {error&&<p className="nearby-error">{error}</p>}

          {nearby.length>0&&(
            <div className="nearby-results">
              <strong>Public projects nearby</strong>

              {nearby.map(item=>(
                <div className="nearby-row" key={item.id}>
                  <span>
                    {readableLocationLabel(
                      item.location_label,
                      item.name
                    )}

                    <small>{item.name}</small>
                  </span>

                  <b>{formatDistance(item.distance)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
