// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import MealExtras from './MealExtras';
import api from '../services/api';
vi.mock('../services/api',()=>({default:{get:vi.fn(),post:vi.fn()},errorMessage:e=>e.message}));
vi.mock('../i18n/useTranslation',()=>({useTranslation:()=>Object.assign(v=>v,{locale:'en-IN'})}));
beforeEach(()=>{
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  api.get.mockResolvedValue({data:{plan_id:7,items:[{id:3,name:'Extra roti',price:20,description:'Fresh',meal_types:['lunch']}]}});
});
afterEach(cleanup);
it('shows selected totals and keeps the checkout key for an unchanged retry',async()=>{
  api.post.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({data:{bill_id:99,total:40}});
  render(<MemoryRouter><MealExtras meal={{id:1,date:'2026-10-18',meal_type:'lunch'}} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Add extras'}));
  const input=await screen.findByRole('spinbutton',{name:'Extra roti'});
  fireEvent.change(input,{target:{value:'2'}});
  expect(screen.getByTestId('extras-total').textContent).toContain('40.00');
  fireEvent.click(screen.getByRole('button',{name:'Confirm extra order'}));
  await screen.findByText('Connection lost');
  const key=api.post.mock.calls[0][1].purchase_key;
  fireEvent.click(screen.getByRole('button',{name:'Confirm extra order'}));
  await screen.findByRole('link',{name:'Pay extra balance'});
  expect(api.post.mock.calls[1][1].purchase_key).toBe(key);
  expect(screen.getByRole('link',{name:'Pay extra balance'}).getAttribute('href')).toBe('/customer/checkout?bill=99');
  expect(screen.queryByRole('button',{name:'Confirm extra order'})).toBeNull();
});
it('keeps empty and failed catalogues distinct and offers reload',async()=>{
  api.get.mockRejectedValueOnce(new Error('Cannot load')).mockResolvedValueOnce({data:{plan_id:7,items:[]}});
  render(<MemoryRouter><MealExtras meal={{id:1,date:'2026-10-18',meal_type:'lunch'}} /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button',{name:'Add extras'}));
  await screen.findByText('Cannot load');
  fireEvent.click(screen.getByRole('button',{name:'Refresh items'}));
  await screen.findByText('No extras available for this meal.');
  await waitFor(()=>expect(screen.queryByText('Cannot load')).toBeNull());
});
