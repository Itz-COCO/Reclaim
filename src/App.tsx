import {Navigate,Outlet,Route,Routes} from 'react-router-dom';
import {AuthProvider,useAuth} from './context/AuthContext';
import {WorkspaceProvider} from './context/WorkspaceContext';
import {AppShell} from './components/AppShell';
import {AuthPage} from './pages/AuthPage';
import {DashboardPage} from './pages/DashboardPage';
import {ProjectsPage} from './pages/ProjectsPage';
import {NewProjectPage} from './pages/NewProjectPage';
import {ProjectPage} from './pages/ProjectPage';
import {EvidencePage} from './pages/EvidencePage';
import {AccountPage} from './pages/AccountPage';
import {PublicDakotaPage} from './pages/PublicDakotaPage';

function LoadingScreen(){return <div className="loading-screen"><img src="/reclaim-logo.jpg" alt=""/><span>Opening your workspace…</span></div>;}
function RequireUser(){const {user,loading}=useAuth();if(loading)return <LoadingScreen/>;return user?<Outlet/>:<Navigate to="/auth" replace/>;}
function GuestOnly(){const {user,loading}=useAuth();if(loading)return <LoadingScreen/>;return user?<Navigate to="/" replace/>:<AuthPage/>;}

function RoutedApp(){
  return <WorkspaceProvider><Routes>
    <Route path="/auth" element={<GuestOnly/>}/>
    <Route path="/explore/dakota-crescent" element={<PublicDakotaPage/>}/>
    <Route element={<RequireUser/>}><Route element={<AppShell/>}>
      <Route path="/" element={<DashboardPage/>}/>
      <Route path="/projects" element={<ProjectsPage/>}/>
      <Route path="/projects/new" element={<NewProjectPage/>}/>
      <Route path="/projects/:projectId" element={<ProjectPage/>}/>
      <Route path="/evidence" element={<EvidencePage/>}/>
      <Route path="/account" element={<AccountPage/>}/>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Route></Route>
  </Routes></WorkspaceProvider>;
}

export default function App(){return <AuthProvider><RoutedApp/></AuthProvider>;}
