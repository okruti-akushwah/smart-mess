// @vitest-environment jsdom
import {it,expect,vi,afterEach} from 'vitest';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import Signup from './Signup';
import api from '../services/api';
vi.mock('../services/api',()=>({default:{get:vi.fn(async()=>({data:{demo_registration:false}})),post:vi.fn()},errorMessage:e=>e.message}));
vi.mock('../components/SignupOtp',()=>({default:({onVerified})=><button type='button' onClick={()=>onVerified('test-challenge')}>Verify test phone</button>}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('moves current registration stage only after verification and resets it when the phone changes',async()=>{render(<MemoryRouter><Signup/></MemoryRouter>);const stages=await screen.findByRole('navigation',{name:'Registration progress'});expect(stages.querySelector('[aria-current="step"]').textContent).toBe('1. Verify mobile');fireEvent.change(screen.getByLabelText('Phone number / login ID'),{target:{value:'9000000002'}});fireEvent.click(await screen.findByRole('button',{name:'Verify test phone'}));expect(stages.querySelector('[aria-current="step"]').textContent).toBe('2. Account details');expect(screen.getByText('Mobile verified')).toBeTruthy();fireEvent.change(screen.getByLabelText('Phone number / login ID'),{target:{value:'9000000003'}});expect(stages.querySelector('[aria-current="step"]').textContent).toBe('1. Verify mobile');expect(api.post).not.toHaveBeenCalled();});
