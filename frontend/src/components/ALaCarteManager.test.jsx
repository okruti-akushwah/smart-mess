// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import ALaCarteManager from './ALaCarteManager';
import api from '../services/api';
vi.mock('../services/api',()=>({default:{get:vi.fn(),post:vi.fn(),put:vi.fn()},errorMessage:e=>e.message}));
vi.mock('../i18n/useTranslation',()=>({useTranslation:()=>Object.assign(v=>v,{locale:'en-IN'})}));
beforeEach(()=>vi.clearAllMocks());
afterEach(cleanup);
it('creates an item and can make it unavailable without deleting the record',async()=>{
  const item={id:1,name:'Roti',name_hi:'',description:'',description_hi:'',price:20,meal_types:['lunch','dinner'],available:true};
  api.get.mockResolvedValueOnce({data:[]}).mockResolvedValueOnce({data:[item]}).mockResolvedValueOnce({data:[{...item,available:false}]});
  api.post.mockResolvedValue({data:item});api.put.mockResolvedValue({data:{...item,available:false}});
  render(<ALaCarteManager/>);
  await screen.findByText('No extra items yet. Add your first item below.');
  fireEvent.change(screen.getByLabelText('Item name (English)'),{target:{value:'Roti'}});
  fireEvent.change(screen.getByLabelText('Price per item (₹)'),{target:{value:'20'}});
  fireEvent.click(screen.getByRole('button',{name:'Save extra item'}));
  await screen.findByRole('heading',{name:'Roti'});
  fireEvent.click(screen.getByRole('button',{name:'Edit extra item: Roti'}));
  fireEvent.click(screen.getByLabelText('Available for ordering'));
  fireEvent.click(screen.getByRole('button',{name:'Save extra item'}));
  await screen.findByText('Unavailable');
  expect(screen.getByRole('heading',{name:'Roti'})).toBeTruthy();
});
