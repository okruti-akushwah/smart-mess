// @vitest-environment jsdom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {useState} from 'react';
import MenuPhotoEditor from './MenuPhotoEditor';
import api from '../services/api';
vi.mock('../services/api',()=>({default:{post:vi.fn(),defaults:{baseURL:'/api'}},errorMessage:e=>e.message}));
const onBusy=()=>{};
beforeEach(()=>vi.clearAllMocks());afterEach(cleanup);
function Photo(){const [url,setUrl]=useState('/old.png');return <MenuPhotoEditor menu='Dal and rice' imageUrl={url} onImage={(_menu,next)=>setUrl(next)} onBusy={onBusy}/>;}
it('describes the replacement upload accurately and marks it as a draft',async()=>{api.post.mockResolvedValue({data:{image_url:'/new.png'}});render(<Photo/>);fireEvent.change(screen.getByLabelText('Upload menu photo'),{target:{files:[new File(['picture'],'dal.png',{type:'image/png'})]}});await screen.findByRole('img',{name:'Uploaded photo: Dal and rice'});expect(screen.getByText('Ready to save')).toBeTruthy();expect(screen.getByText('Save the meal to publish this photo.')).toBeTruthy();});
it('rejects unsupported files without a request',async()=>{render(<Photo/>);fireEvent.change(screen.getByLabelText('Upload menu photo'),{target:{files:[new File(['text'],'notes.txt',{type:'text/plain'})]}});await screen.findByRole('alert');expect(api.post).not.toHaveBeenCalled();});

it("does not label an unchanged persisted photo as an unsaved draft",()=>{render(<Photo/>);expect(screen.queryByText("Ready to save")).toBeNull();expect(screen.getByText("Saved photo")).toBeTruthy();});
