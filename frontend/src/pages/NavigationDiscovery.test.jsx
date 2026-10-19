// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {MemoryRouter,Routes,Route,useLocation} from 'react-router-dom';
import MessDirectory from './MessDirectory';
import Explore from './Explore';
import JoinMess from './JoinMess';
import Login from './Login';
import api from '../services/api';
vi.mock('../services/api',()=>({default:{get:vi.fn(),post:vi.fn()},errorMessage:(e,f)=>e.message||f}));
vi.mock('../services/dynamicTranslations',()=>({translateSaved:vi.fn(async(_k,_id,_field,text)=>text)}));
vi.mock('../i18n/useTranslation',()=>({useTranslation:()=>Object.assign(v=>v,{locale:'en-IN'})}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();});
afterEach(cleanup);
function Location(){const l=useLocation();return <output data-testid="location">{l.pathname}{l.search}{l.hash}</output>}
function mount(node,path='/'){return render(<MemoryRouter initialEntries={[path]}>{node}<Location/></MemoryRouter>)}

it('loads public price comparisons on demand and scopes both reads to the card kitchen',async()=>{
 localStorage.setItem('activeMessToken','another-kitchen');
 api.get.mockImplementation(async url=>({data:url==='/public/messes'?[{name:'Annapurna',join_token:'demo'}]:url==='/public/menu'?[{single_price:60},{single_price:100}]:[{id:3,name:'Week',price:700,duration_days:7}]}));
 mount(<MessDirectory/>);
 const card=(await screen.findByRole('heading',{name:'Annapurna'})).closest('article');
 expect(api.get).toHaveBeenCalledTimes(1);
 fireEvent.click(within(card).getByRole('button',{name:'Show prices'}));
 await within(card).findByText(/₹60/);
 expect(within(card).getByText(/₹700/)).toBeTruthy();
 for(const [url,config] of api.get.mock.calls.filter(([u])=>u!=='/public/messes')){
  expect(['/public/menu','/public/plans']).toContain(url);expect(config.params.mess_token).toBe('demo');
 }
 expect(localStorage.getItem('activeMessToken')).toBe('another-kitchen');
});

it('does not invent prices for an unpublished kitchen',async()=>{
 api.get.mockImplementation(async url=>({data:url==='/public/messes'?[{name:'Empty kitchen',join_token:'empty'}]:[]}));
 mount(<MessDirectory/>);await screen.findByRole('heading',{name:'Empty kitchen'});
 fireEvent.click(screen.getByRole('button',{name:'Show prices'}));
 await screen.findByText('No prices published yet.');
 expect(screen.queryByText(/₹0/)).toBeNull();
});

it('keeps available prices and offers a retry after a partial price failure',async()=>{
 let failing=true;
 api.get.mockImplementation(async url=>{
  if(url==='/public/menu' && failing)throw new Error('Temporary menu failure');
  return {data:url==='/public/messes'?[{name:'Kitchen',join_token:'demo'}]:url==='/public/menu'?[{single_price:60}]:[{price:700,duration_days:7}]};
 });
 mount(<MessDirectory/>);await screen.findByRole('heading',{name:'Kitchen'});
 fireEvent.click(screen.getByRole('button',{name:'Show prices'}));
 await screen.findByRole('alert');expect(screen.getByText(/₹700/)).toBeTruthy();
 failing=false;fireEvent.click(screen.getByRole('button',{name:'Retry prices'}));
 await screen.findByText(/₹60/);expect(screen.queryByRole('alert')).toBeNull();
});

it('opens the requested kitchen plans without showing a different selected kitchen',async()=>{
 localStorage.setItem('activeMessToken','another-kitchen');
 api.get.mockImplementation(async url=>({data:url==='/public/mess/demo'?{name:'Annapurna',join_token:'demo'}:url==='/public/plans'?[{id:3,name:'Weekly comfort',price:700,duration_days:7,category:'regular'}]:[]}));
 mount(<Explore/>,'/explore?mess=demo&view=plans');
 await screen.findByRole('heading',{name:'Annapurna'});
 await screen.findByRole('heading',{name:'Weekly comfort'});
 expect(screen.queryByRole('heading',{name:'The live menu'})).toBeNull();
 expect(screen.getByRole('link',{name:'Choose this plan'}).getAttribute('href')).toBe('/join/demo?next=%2Fcustomer%2Fplans%2Fbrowse%3Foffer%3D3');
 expect(api.get.mock.calls.filter(([u])=>['/public/menu','/public/plans','/public/reviews'].includes(u)).every(([,c])=>c.params.mess_token==='demo')).toBe(true);
 expect(localStorage.getItem('activeMessToken')).toBe('another-kitchen');
});

it('asks a public visitor to choose a kitchen instead of using an unidentified default',()=>{
 mount(<Explore/>,'/explore');
 expect(screen.getByText('Choose a mess to explore its menu and plans.')).toBeTruthy();
 expect(api.get).not.toHaveBeenCalled();
});

it('does not call a failed catalog an unpublished kitchen and can retry it',async()=>{
 let failing=true;
 api.get.mockImplementation(async url=>{
  if(url==='/public/mess/demo')return {data:{name:'Kitchen',join_token:'demo'}};
  if(failing)throw new Error('Catalog unavailable');
  return {data:url==='/public/plans'?[{id:1,name:'Week',price:700,duration_days:7}]:[]};
 });
 mount(<Explore/>,'/explore?mess=demo&view=plans');
 await screen.findByRole('alert');
 expect(screen.queryByText('Your owner has not published plans in this category yet.')).toBeNull();
 failing=false;fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await screen.findByRole('heading',{name:'Week'});
});

it('keeps the owner workspace destinations when changing sections in their own kitchen',async()=>{
 localStorage.setItem('token','owner');localStorage.setItem('role','owner');
 api.get.mockImplementation(async url=>({data:url==='/public/mess'?{name:'Owner kitchen',join_token:'own'}:url==='/public/plans'?[{id:1,name:'Own weekly',price:700,duration_days:7}]:[]}));
 mount(<Explore/>,'/explore');
 await screen.findByRole('heading',{name:'Owner kitchen'});
 fireEvent.click(screen.getByRole('button',{name:'Plans & prices'}));
 expect((await screen.findByRole('link',{name:'Manage plans'})).getAttribute('href')).toBe('/owner/plans');
});

it('lets a waiting member refresh status and preserves the selected meal on approval',async()=>{
 localStorage.setItem('token','demo');localStorage.setItem('role','customer');let approved=false;
 api.get.mockImplementation(async url=>({data:url.startsWith('/join/')?{mess_name:'Annapurna'}:[{join_token:'demo',status:approved?'approved':'pending'}]}));
 mount(<Routes><Route path="/join/:token" element={<JoinMess/>}/></Routes>,'/join/demo?next=%2Fcustomer%2Fchoose%23meal-8');
 await screen.findByText('Waiting for owner approval');
 expect(screen.getByRole('link',{name:'Mess details & contact'}).getAttribute('href')).toBe('/mess/demo#visit');
 approved=true;fireEvent.click(screen.getByRole('button',{name:'Check request'}));
 fireEvent.click(await screen.findByRole('button',{name:'Continue to selected meal'}));
 await waitFor(()=>expect(screen.getByTestId('location').textContent).toBe('/customer/choose#meal-8'));
 expect(api.post).not.toHaveBeenCalled();
});

it('offers sign-in guidance without claiming an unsupported password reset',()=>{
 mount(<Login/>,'/login');
 fireEvent.click(screen.getByText('Sign-in help',{selector:'summary'}));
 expect(screen.getByText('Check your 10-digit phone number and password.')).toBeTruthy();
 expect(screen.getByRole('link',{name:'How Smart Mess works'}).getAttribute('href')).toBe('/#how-it-works');
 expect(screen.queryByRole('link',{name:/reset password/i})).toBeNull();
});
