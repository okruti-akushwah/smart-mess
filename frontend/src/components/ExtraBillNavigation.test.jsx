// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import BillWorkflow from './BillWorkflow';
import api from '../services/api';
vi.mock('../services/api',()=>({default:{get:vi.fn()},errorMessage:e=>e.message}));
vi.mock('../i18n/useTranslation',()=>({useTranslation:()=>Object.assign(v=>v,{locale:'en-IN'})}));
afterEach(cleanup);
it('offers payment only for the latest cumulative booking bill',async()=>{
  const base={plan_id:1,name:'Plan',kind:'subscription',status:'active',created_at:'2026-10-17T10:00:00',start_date:'2026-10-17',end_date:'2026-10-30',base_amount:1000,deductions:0,amount_paid:1000};
  api.get.mockImplementation(async url=>({data:url==='/bills/issued'?[{...base,id:3,extras_total:80,final_amount:1080,balance_due:80},{...base,id:2,extras_total:40,final_amount:1040,balance_due:40}]:[]}));
  render(<MemoryRouter><BillWorkflow payOnCheckout/></MemoryRouter>);
  await screen.findByText('Bill #3',{exact:false,selector:'summary'});
  const links=screen.getAllByRole('link',{name:'Pay now'});
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('href')).toBe('/customer/checkout?bill=3');
  expect(screen.getByText('Current bill')).toBeTruthy();
  expect(screen.getByText('Previous bill')).toBeTruthy();
  expect(screen.getByRole('link',{name:'View current bill #3'}).getAttribute('href')).toBe('#bill-3');
});
