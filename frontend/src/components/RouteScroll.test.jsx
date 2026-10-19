// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,Link,useNavigate,useLocation} from 'react-router-dom';
import RouteScroll from './RouteScroll';
function Pages(){const n=useNavigate(),l=useLocation();return <><Link to="/mess/test">View mess</Link><Link to="/customer/choose#meal-8">Selected meal</Link><Link to="?bill=24">Bill query</Link><button onClick={()=>n(-1)}>Back</button><main><h1>{l.pathname}</h1></main></>}
beforeEach(()=>{vi.spyOn(window,'scrollTo').mockImplementation(()=>{});});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('starts a new page at its heading rather than the search-result scroll position',()=>{
 render(<MemoryRouter><RouteScroll/><Pages/></MemoryRouter>);
 window.scrollTo.mockClear();fireEvent.click(screen.getByRole('link',{name:'View mess'}));
 expect(window.scrollTo).toHaveBeenCalledWith({top:0,left:0,behavior:'instant'});
 expect(document.activeElement).toBe(screen.getByRole('heading'));
});
it('leaves meal hashes and same-page query changes to their existing handlers',()=>{
 render(<MemoryRouter><RouteScroll/><Pages/></MemoryRouter>);
 window.scrollTo.mockClear();fireEvent.click(screen.getByRole('link',{name:'Bill query'}));
 expect(window.scrollTo).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('link',{name:'Selected meal'}));
 expect(window.scrollTo).not.toHaveBeenCalled();
});

it.each([['/mess/demo#visit','visit'],['/customer#meal-8','meal-8']])('reveals the delayed destination for %s',async(path,id)=>{
 const scroll=vi.fn();HTMLElement.prototype.scrollIntoView=scroll;
 const page=ready=><MemoryRouter initialEntries={[path]}><RouteScroll/><main>{ready?<section id={id}>Destination</section>:<p>Loading</p>}</main></MemoryRouter>;
 const view=render(page(false));view.rerender(page(true));
 try {await waitFor(()=>expect(document.activeElement?.id).toBe(id));expect(scroll).toHaveBeenCalled();}
 finally {delete HTMLElement.prototype.scrollIntoView;}
});
it('restores the previous history entry on Back',()=>{
 render(<MemoryRouter><RouteScroll/><Pages/></MemoryRouter>);
 const y=vi.spyOn(window,'scrollY','get').mockReturnValue(720);
 fireEvent.scroll(window);fireEvent.click(screen.getByRole('link',{name:'View mess'}));
 y.mockReturnValue(0);window.scrollTo.mockClear();fireEvent.click(screen.getByRole('button',{name:'Back'}));
 expect(window.scrollTo).toHaveBeenCalledWith({top:720,left:0,behavior:'instant'});
});

it('focuses a heading that arrives after the public API finishes',async()=>{
 const page=ready=><MemoryRouter><RouteScroll/><main>{ready?<h1>Kitchen menu</h1>:<p>Loading kitchen</p>}</main></MemoryRouter>;
 const view=render(page(false));view.rerender(page(true));
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Kitchen menu'})));
});

it('moves focus from a replaced access-gate heading into the destination',async()=>{
 const page=ready=><MemoryRouter><RouteScroll/><main key={String(ready)}><h1>{ready?'Your meals':'Checking access'}</h1></main></MemoryRouter>;
 const view=render(page(false));view.rerender(page(true));
 await waitFor(()=>expect(document.activeElement).toBe(screen.getByRole('heading',{name:'Your meals'})));
});

it('does not override wheel scrolling while Back content is loading',async()=>{
 const page=label=><MemoryRouter><RouteScroll/><Pages/><div>{label==='Loaded'?<aside>Loaded content</aside>:null}</div></MemoryRouter>;
 const view=render(page('Loading'));
 const y=vi.spyOn(window,'scrollY','get').mockReturnValue(720);
 fireEvent.scroll(window);fireEvent.click(screen.getByRole('link',{name:'View mess'}));
 y.mockReturnValue(0);fireEvent.click(screen.getByRole('button',{name:'Back'}));
 fireEvent.wheel(window);window.scrollTo.mockClear();
 await act(async()=>view.rerender(page('Loaded')));
 expect(window.scrollTo).not.toHaveBeenCalled();
});
