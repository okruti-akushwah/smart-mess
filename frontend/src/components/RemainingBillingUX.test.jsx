// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import BillWorkflow from './BillWorkflow';
import api from '../services/api';
vi.mock('../services/api',()=>({default:{get:vi.fn(),post:vi.fn()},errorMessage:e=>e.message}));
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
it('requires the customer to enter what was actually paid rather than prefill the due amount',async()=>{api.get.mockImplementation(async u=>({data:u==='/bills/issued'?[{id:1,plan_id:1,name:'Lunch',balance_due:120,status:'active'}]:[]}));render(<MemoryRouter><BillWorkflow checkout targetBillId='1'/></MemoryRouter>);const input=await screen.findByLabelText('Amount you already paid (₹)');expect(screen.getByRole('heading',{name:'Payment details'})).toBeTruthy();expect(input.value).toBe('');expect(input.required).toBe(true);expect(api.post).not.toHaveBeenCalled();});
it('puts pending review first while retaining searchable receipt history',async()=>{api.get.mockImplementation(async u=>({data:u==='/payments/submissions'?[{id:1,bill_id:1,name:'Aarav',purchase_name:'Lunch',status:'pending',amount:120},{id:2,bill_id:2,name:'Priya',purchase_name:'Dinner',status:'approved',amount:100}]:[]}));render(<MemoryRouter><BillWorkflow owner view='payments'/></MemoryRouter>);await screen.findByText(/Aarav/);expect(screen.queryByText(/Priya/)).toBeNull();fireEvent.change(screen.getByLabelText('Payment status'),{target:{value:'all'}});expect(screen.getByText(/Priya/)).toBeTruthy();fireEvent.change(screen.getByLabelText('Search bills and payments'),{target:{value:'Priya'}});expect(screen.queryByText(/Aarav/)).toBeNull();expect(api.post).not.toHaveBeenCalled();});
