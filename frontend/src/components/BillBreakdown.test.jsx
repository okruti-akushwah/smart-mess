// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import BillHistory from '../pages/BillHistory';
import CustomerCheckout from '../pages/CustomerCheckout';
import BillBreakdown from './BillBreakdown';
import {MemoryRouter} from 'react-router-dom';
import api from '../services/api';
vi.mock('../services/api',()=>({default:{get:vi.fn()},errorMessage:e=>e.message}));
vi.mock('./Navbar',()=>({default:()=>null}));
vi.mock('./BillWorkflow',()=>({default:()=>null}));
vi.mock('./PaymentHistory',()=>({default:()=>null}));
vi.mock('../i18n/useTranslation',()=>({useTranslation:()=>Object.assign(v=>v,{locale:'en-IN'})}));
afterEach(cleanup);
const bill={id:24,plan_id:1,name:'Everyday',kind:'subscription',status:'active',base_amount:4500,deductions:0,extras_total:120,final_amount:4620,amount_paid:4500,balance_due:120,start_date:'2026-10-17',end_date:'2026-11-17',extra_lines:[{order_id:1,item_id:1,name:'Extra roti',quantity:3,unit_price:20,total:60}]};
for (const page of ['live bill','checkout']) it(`separates guest and extra-dish charges in ${page} without changing the balance`,async()=>{
 api.get.mockImplementation(async url=>({data:url==='/customer/activity'?{purchases:[bill]}:url==='/bills/issued'?[bill]:bill}));
 render(<MemoryRouter initialEntries={['/customer/checkout?bill=24']}>{page==='checkout'?<CustomerCheckout/>:<BillHistory/>}</MemoryRouter>);
 const guest=await screen.findByText('Guest charges');
 expect(guest.parentElement.textContent).toContain('₹60.00');
 expect(screen.getByText('Extra dishes').parentElement.textContent).toContain('₹60.00');
 expect(screen.getByText('Amount due').parentElement.textContent).toContain('₹120.00');
 expect(screen.getByText('Total').parentElement.textContent).toContain('₹4,620.00');
});

it('does not describe a cancelled checkout as money still owed',async()=>{
 api.get.mockResolvedValue({data:{purchases:[{...bill,status:'cancelled',amount_paid:0,balance_due:4620}]}});
 render(<MemoryRouter initialEntries={['/customer/checkout?bill=24']}><CustomerCheckout/></MemoryRouter>);
 await screen.findByText('This checkout was cancelled.');
 expect(screen.queryByText('Amount due')).toBeNull();
 expect(screen.getByText('Total').parentElement.textContent).toContain('₹4,620.00');
});

it('identifies a single meal price and keeps unavailable item details combined',()=>{
 render(<BillBreakdown bill={{...bill,kind:'meal',extra_lines:undefined}}/>);
 expect(screen.getByText('Meal price')).toBeTruthy();
 expect(screen.getByText('Guests & extra dishes').parentElement.textContent).toContain('₹120.00');
 expect(screen.queryByText('Guest charges')).toBeNull();
});
